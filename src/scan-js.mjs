/**
 * JavaScript / TypeScript dependency scanner.
 *
 * Strategy (two tiers, conservative — favours false-negatives over crying wolf):
 *   1. Extract every module specifier from import/require/dynamic-import across
 *      the source corpus → normalise to package name → "used (import)".
 *   2. For deps not imported, fall back to a bareword scan of the reference
 *      corpus (build configs, package.json scripts) → "used (config/script)".
 *   3. Whatever remains → "unused".
 */

import fs from 'node:fs';
import path from 'node:path';
import { collectFiles, collectRootConfigs, readSafe } from './walk.mjs';
import { makeIgnoreMatcher, barewordPresent, referenceContribution } from './match.mjs';

// import x from 'pkg' | import 'pkg' | export … from 'pkg'
const RE_IMPORT_FROM = /(?:import|export)\b[^'"`]*?\bfrom\s*['"]([^'"]+)['"]/g;
const RE_IMPORT_BARE = /import\s*['"]([^'"]+)['"]/g;
const RE_IMPORT_DYNAMIC = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const RE_REQUIRE = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const RE_REQUIRE_RESOLVE = /require\.resolve\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

// CSS / SCSS / SASS / LESS: @import "pkg", @use 'pkg', @forward 'pkg',
// @import url("pkg/...") — webpack `~pkg` tilde supported.
const RE_STYLE_AT = /@(?:import|use|forward)\s+(?:\([^)]*\)\s*)?(?:url\(\s*)?['"]([^'")]+)['"]/g;

/** Turn an import specifier into its owning package name (or null if local). */
export function packageFromSpecifier( spec ) {
	if ( ! spec || spec.startsWith( '.' ) || spec.startsWith( '/' ) ) {
		return null;
	}
	// Strip node: protocol / query suffixes occasionally seen in loaders.
	const clean = spec.replace( /^node:/, '' );
	if ( clean.startsWith( '@' ) ) {
		const parts = clean.split( '/' );
		return parts.length >= 2 ? `${ parts[ 0 ] }/${ parts[ 1 ] }` : clean;
	}
	return clean.split( '/' )[ 0 ];
}

/** Normalise a stylesheet specifier to a package name (or null if local/builtin). */
function packageFromStyleSpecifier( spec ) {
	const clean = spec.replace( /^~/, '' ); // strip webpack tilde
	if ( clean.startsWith( 'sass:' ) ) {
		return null; // Sass built-in module
	}
	return packageFromSpecifier( clean );
}

function extractStyleSpecifiers( text, into ) {
	RE_STYLE_AT.lastIndex = 0;
	let m;
	while ( ( m = RE_STYLE_AT.exec( text ) ) !== null ) {
		const pkg = packageFromStyleSpecifier( m[ 1 ] );
		if ( pkg ) {
			into.add( pkg );
		}
	}
	// Tailwind directives imply the tailwindcss package even without an @import.
	if ( /@tailwind\b|@apply\b/.test( text ) ) {
		into.add( 'tailwindcss' );
	}
}

function extractSpecifiers( text, into ) {
	for ( const re of [
		RE_IMPORT_FROM,
		RE_IMPORT_BARE,
		RE_IMPORT_DYNAMIC,
		RE_REQUIRE,
		RE_REQUIRE_RESOLVE,
	] ) {
		re.lastIndex = 0;
		let m;
		while ( ( m = re.exec( text ) ) !== null ) {
			const pkg = packageFromSpecifier( m[ 1 ] );
			if ( pkg ) {
				into.add( pkg );
			}
		}
	}
}

/**
 * @returns {{ deps: object[], stats: object }}
 *   deps: { name, section, status, reason } where status ∈ used|config|unused|ignored
 */
export function scanJs( root, cfg ) {
	const pkgPath = path.join( root, 'package.json' );
	if ( ! fs.existsSync( pkgPath ) ) {
		return { deps: [], stats: { skipped: 'no package.json' } };
	}
	const pkgJson = JSON.parse( readSafe( pkgPath ) || '{}' );
	const sections = [
		[ 'dependencies', pkgJson.dependencies || {} ],
		[ 'devDependencies', pkgJson.devDependencies || {} ],
	];

	// Build the import + reference corpus.
	const codeFiles = collectFiles( root, cfg.scan, { extensions: cfg.extensions } );
	const used = new Set();
	const styleUsed = new Set();
	const refParts = [];
	for ( const file of codeFiles ) {
		const text = readSafe( file );
		extractSpecifiers( text, used );
		refParts.push( text );
	}
	// Stylesheets — @import / @use / @forward / @tailwind reference packages too.
	const styleFiles = collectFiles( root, cfg.scan, { extensions: cfg.styleExtensions || [] } );
	for ( const file of styleFiles ) {
		const text = readSafe( file );
		extractStyleSpecifiers( text, styleUsed );
		refParts.push( text );
	}
	const refFiles = new Set();
	for ( const rel of cfg.referenceFiles || [] ) {
		const abs = path.join( root, rel );
		if ( fs.existsSync( abs ) ) {
			refFiles.add( abs );
		}
	}
	// Auto-discover root config files (flat eslint config, postcss, etc.).
	for ( const abs of collectRootConfigs( root, [
		'.js', '.cjs', '.mjs', '.ts', '.cts', '.mts', '.json', '.yml', '.yaml',
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
			if ( isIgnored( name ) ) {
				deps.push( { name, section, status: 'ignored', reason: 'ignore list' } );
			} else if ( used.has( name ) ) {
				deps.push( { name, section, status: 'used', reason: 'imported' } );
			} else if ( styleUsed.has( name ) ) {
				deps.push( { name, section, status: 'used', reason: 'stylesheet @import/@use' } );
			} else if ( barewordPresent( referenceText, name ) ) {
				deps.push( { name, section, status: 'config', reason: 'config/script/asset reference' } );
			} else {
				deps.push( { name, section, status: 'unused', reason: 'no import or reference found' } );
			}
		}
	}

	return {
		deps,
		stats: {
			filesScanned: codeFiles.length + styleFiles.length,
			specifiers: used.size + styleUsed.size,
		},
	};
}
