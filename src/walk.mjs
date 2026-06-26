/**
 * Recursive filesystem walk with directory-ignore + extension filtering.
 *
 * Zero dependencies — Node built-ins only. Accepts files OR directories as
 * entry points; a file entry is yielded directly, a directory is walked.
 */

import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_IGNORE_DIRS = new Set( [
	'.git',
	'node_modules',
	'vendor',
	'build',
	'dist',
	'coverage',
	'temp',
	'tmp',
	'.yarn',
	'.cache',
	'languages',
	'@archives',
] );

/**
 * Collect files under the given entry paths.
 *
 * @param {string}   root        Absolute project root.
 * @param {string[]} entries     Paths (files or dirs) relative to root.
 * @param {object}   [opts]
 * @param {string[]} [opts.extensions] Lower-case extensions to keep (incl. dot). Empty = all.
 * @param {string[]} [opts.ignoreDirs] Extra directory names to skip.
 * @returns {string[]} Absolute file paths.
 */
export function collectFiles( root, entries, opts = {} ) {
	const exts = new Set( ( opts.extensions || [] ).map( ( e ) => e.toLowerCase() ) );
	const ignore = new Set( DEFAULT_IGNORE_DIRS );
	for ( const d of opts.ignoreDirs || [] ) {
		ignore.add( d );
	}

	const out = [];
	const seen = new Set();

	const keep = ( file ) => {
		if ( exts.size && ! exts.has( path.extname( file ).toLowerCase() ) ) {
			return;
		}
		if ( ! seen.has( file ) ) {
			seen.add( file );
			out.push( file );
		}
	};

	const walkDir = ( dir ) => {
		let dirents;
		try {
			dirents = fs.readdirSync( dir, { withFileTypes: true } );
		} catch {
			return;
		}
		for ( const ent of dirents ) {
			if ( ent.isDirectory() ) {
				if ( ignore.has( ent.name ) ) {
					continue;
				}
				walkDir( path.join( dir, ent.name ) );
			} else if ( ent.isFile() ) {
				keep( path.join( dir, ent.name ) );
			}
		}
	};

	for ( const entry of entries ) {
		const abs = path.isAbsolute( entry ) ? entry : path.join( root, entry );
		let stat;
		try {
			stat = fs.statSync( abs );
		} catch {
			continue; // entry does not exist — skip silently
		}
		if ( stat.isDirectory() ) {
			walkDir( abs );
		} else if ( stat.isFile() ) {
			keep( abs );
		}
	}

	return out;
}

// Lock files must never enter the reference corpus — they list every dependency
// by name and would make every package "match itself".
const LOCK_RE = /(^|[/\\])(package-lock\.json|composer\.lock|.*\.lock|yarn\.lock|pnpm-lock\.yaml)$/i;

// Root-level files that legitimately reference packages by name (build configs,
// lint configs, tool configs). Matched by name regardless of project.
const CONFIG_NAME_RE =
	/(^\.|^config[.-]|\.config\.|rc(\.|$)|eslint|stylelint|prettier|babel|postcss|tailwind|webpack|jest|playwright|tsconfig|phpstan|phpcs|rector|phpunit|grunt)/i;

/**
 * Collect depth-0 config-like files at the project root, so reference scanning
 * works without per-project hardcoding of config filenames.
 *
 * @param {string}   root  Absolute project root.
 * @param {string[]} exts  Extensions (incl. dot) to accept.
 * @returns {string[]} Absolute paths.
 */
export function collectRootConfigs( root, exts ) {
	const want = new Set( exts.map( ( e ) => e.toLowerCase() ) );
	let dirents;
	try {
		dirents = fs.readdirSync( root, { withFileTypes: true } );
	} catch {
		return [];
	}
	const out = [];
	for ( const ent of dirents ) {
		if ( ! ent.isFile() ) {
			continue;
		}
		const name = ent.name;
		if ( LOCK_RE.test( name ) ) {
			continue;
		}
		if ( ! want.has( path.extname( name ).toLowerCase() ) ) {
			continue;
		}
		if ( CONFIG_NAME_RE.test( name ) ) {
			out.push( path.join( root, name ) );
		}
	}
	return out;
}

/** Read a file as UTF-8, returning '' on any error. */
export function readSafe( file ) {
	try {
		return fs.readFileSync( file, 'utf8' );
	} catch {
		return '';
	}
}
