/**
 * Shared matching helpers — glob-ish package ignore + bareword reference scan.
 */

/** Escape a string for safe insertion into a RegExp. */
export function escapeRegExp( str ) {
	return str.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );
}

/**
 * Convert a simple glob (`*` wildcard only) into a RegExp anchored full-match.
 * e.g. `@types/*` → /^@types\/.*$/, `eslint-*` → /^eslint-.*$/.
 */
function globToRegExp( glob ) {
	const body = glob
		.split( '*' )
		.map( escapeRegExp )
		.join( '.*' );
	return new RegExp( `^${ body }$` );
}

/**
 * Build a predicate that returns true when a package name matches any of the
 * given ignore patterns (exact names or `*`-globs).
 */
export function makeIgnoreMatcher( patterns = [] ) {
	const exact = new Set();
	const globs = [];
	for ( const p of patterns ) {
		if ( p.includes( '*' ) ) {
			globs.push( globToRegExp( p ) );
		} else {
			exact.add( p );
		}
	}
	return ( name ) => exact.has( name ) || globs.some( ( re ) => re.test( name ) );
}

/**
 * Return a reference-corpus contribution for a file.
 *
 * Manifests (package.json / composer.json) list every dependency by name in
 * their require blocks — folding those in would make every dep match itself.
 * So for manifests we contribute only the parts that legitimately *reference*
 * a package by name: the `scripts` (CLI bins) and `extra` blocks.
 */
export function referenceContribution( basename, raw ) {
	if ( basename === 'package.json' || basename === 'composer.json' ) {
		try {
			const json = JSON.parse( raw );
			return JSON.stringify( {
				scripts: json.scripts || {},
				extra: json.extra || {},
			} );
		} catch {
			return '';
		}
	}
	return raw;
}

/**
 * Does `name` appear in `text` as a standalone token (config string / CLI bin /
 * script reference), not merely as a substring of a larger identifier?
 *
 * Boundaries treat word chars, `/`, `.`, `-` as "part of a name" so that
 * `react` does not match inside `react-dom` and `sass` does not match `sass-loader`.
 */
export function barewordPresent( text, name ) {
	const re = new RegExp(
		`(^|[^\\w@/.-])${ escapeRegExp( name ) }([^\\w/.-]|$)`,
		'm'
	);
	return re.test( text );
}
