/**
 * Composer (PHP) dependency scanner.
 *
 * Strategy:
 *   1. Platform requirements (`php`, `ext-*`) are never packages → skipped.
 *   2. Resolve each package's namespace(s) from its installed
 *      `vendor/<pkg>/composer.json` autoload (psr-4 / psr-0). When a package is
 *      not installed, status is "unresolved" (cannot judge).
 *   3. Mark used if any namespace appears as `use Ns\` / `Ns\` in PHP source.
 *      Packages that autoload `files` (global helpers) are conservatively
 *      treated as used — their symbols can't be attributed by namespace.
 *   4. Dev tooling lives in config not code → bareword fallback over the
 *      reference corpus, plus the default ignore list.
 */

import fs from 'node:fs';
import path from 'node:path';
import { collectFiles, collectRootConfigs, readSafe } from './walk.mjs';
import { makeIgnoreMatcher, barewordPresent, referenceContribution } from './match.mjs';

function isPlatform( name ) {
	return name === 'php' || name.startsWith( 'ext-' ) || name.startsWith( 'lib-' ) || name === 'composer-runtime-api';
}

/** Read autoload namespaces + files flag from an installed package. */
function resolveAutoload( root, pkg ) {
	const composer = path.join( root, 'vendor', pkg, 'composer.json' );
	if ( ! fs.existsSync( composer ) ) {
		return { installed: false, namespaces: [], hasFiles: false };
	}
	let json = {};
	try {
		json = JSON.parse( readSafe( composer ) );
	} catch {
		return { installed: true, namespaces: [], hasFiles: false };
	}
	const namespaces = [];
	let hasFiles = false;
	for ( const block of [ json.autoload, json[ 'autoload-dev' ] ] ) {
		if ( ! block ) {
			continue;
		}
		for ( const key of [ 'psr-4', 'psr-0' ] ) {
			for ( const ns of Object.keys( block[ key ] || {} ) ) {
				if ( ns ) {
					namespaces.push( ns.replace( /\\+$/, '' ) ); // trim trailing backslash
				}
			}
		}
		if ( Array.isArray( block.files ) && block.files.length ) {
			hasFiles = true;
		}
	}
	return { installed: true, namespaces, hasFiles };
}

export function scanPhp( root, cfg ) {
	const composerPath = path.join( root, 'composer.json' );
	if ( ! fs.existsSync( composerPath ) ) {
		return { deps: [], stats: { skipped: 'no composer.json' } };
	}
	const composerJson = JSON.parse( readSafe( composerPath ) || '{}' );
	const sections = [
		[ 'require', composerJson.require || {} ],
		[ 'require-dev', composerJson[ 'require-dev' ] || {} ],
	];

	const phpFiles = collectFiles( root, cfg.scan, { extensions: [ '.php' ] } );
	const phpCorpus = phpFiles.map( readSafe ).join( '\n' );

	const refParts = [];
	const refFiles = new Set();
	for ( const rel of cfg.referenceFiles || [] ) {
		const abs = path.join( root, rel );
		if ( fs.existsSync( abs ) ) {
			refFiles.add( abs );
		}
	}
	// Auto-discover root config files (phpstan.neon, phpcs.xml.dist, rector.php…).
	for ( const abs of collectRootConfigs( root, [
		'.neon', '.xml', '.dist', '.php', '.json',
	] ) ) {
		refFiles.add( abs );
	}
	for ( const abs of refFiles ) {
		refParts.push( referenceContribution( path.basename( abs ), readSafe( abs ) ) );
	}
	const referenceText = refParts.join( '\n' );

	const isIgnored = makeIgnoreMatcher( cfg.ignorePackages );
	const deps = [];

	for ( const [ section, map ] of sections ) {
		for ( const name of Object.keys( map ) ) {
			if ( isPlatform( name ) ) {
				deps.push( { name, section, status: 'platform', reason: 'platform requirement' } );
				continue;
			}
			if ( isIgnored( name ) ) {
				deps.push( { name, section, status: 'ignored', reason: 'ignore list (dev tooling)' } );
				continue;
			}

			const { installed, namespaces, hasFiles } = resolveAutoload( root, name );

			if ( ! installed ) {
				// Can't resolve a namespace → fall back to bareword only.
				if ( barewordPresent( referenceText, name ) ) {
					deps.push( { name, section, status: 'config', reason: 'config reference (not installed)' } );
				} else {
					deps.push( { name, section, status: 'unresolved', reason: 'vendor not installed — run composer install' } );
				}
				continue;
			}

			const nsUsed = namespaces.some(
				( ns ) => phpCorpus.includes( `${ ns }\\` ) || referenceText.includes( `${ ns }\\` )
			);

			if ( nsUsed ) {
				deps.push( { name, section, status: 'used', reason: 'namespace referenced' } );
			} else if ( hasFiles ) {
				deps.push( { name, section, status: 'used', reason: 'autoload files (global helpers)' } );
			} else if ( barewordPresent( referenceText, name ) ) {
				deps.push( { name, section, status: 'config', reason: 'config reference' } );
			} else {
				deps.push( { name, section, status: 'unused', reason: 'namespace never referenced' } );
			}
		}
	}

	return { deps, stats: { filesScanned: phpFiles.length } };
}
