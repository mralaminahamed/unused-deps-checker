/**
 * Configuration loading + defaults.
 *
 * Config is plain JSON. CLI flags override the file; the file overrides
 * defaults. Unknown keys are preserved but ignored.
 */

import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_CONFIG = {
	js: {
		enabled: true,
		// Files OR directories scanned for `import`/`require` specifiers AND used
		// as the bareword-reference corpus (config files, build tooling).
		scan: [ 'src', 'tools' ],
		extensions: [ '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.cts', '.mts' ],
		// Extra root files to fold into the reference corpus (configs reference
		// loaders/plugins/presets by bareword, not by import).
		referenceFiles: [
			'package.json',
			'webpack.config.ts',
			'webpack.config.js',
			'babel.config.js',
			'.babelrc',
			'postcss.config.js',
			'tailwind.config.js',
			'tsconfig.json',
			'.eslintrc',
			'.eslintrc.js',
			'.eslintrc.json',
			'.stylelintrc',
			'.stylelintrc.json',
			'.prettierrc',
			'playwright.config.ts',
			'jest.config.js',
		],
		// Packages never reported. `*` is a wildcard. @types/* are skipped by
		// default (low signal — they shadow their runtime peer ambiently).
		ignorePackages: [ '@types/*' ],
	},
	php: {
		enabled: true,
		// PHP source roots searched for `use Namespace\` / `Namespace\` references.
		scan: [ 'includes', 'tests' ],
		// Config corpus where dev-tooling packages are referenced by name.
		referenceFiles: [
			'composer.json',
			'phpstan.neon',
			'phpstan.neon.dist',
			'phpcs.xml',
			'phpcs.xml.dist',
			'phpcs.plugin-review.xml.dist',
			'rector.php',
			'phpunit.xml',
			'phpunit.xml.dist',
		],
		// Dev-only tooling that lives in config, never in `use` statements.
		ignorePackages: [
			'phpstan/*',
			'phpunit/*',
			'phpcs/*',
			'wp-coding-standards/*',
			'php-stubs/*',
			'php-parallel-lint/*',
			'phpcompatibility/*',
			'dealerdirect/*',
			'szepeviktor/*',
			'sirbrillig/*',
			'yoast/*',
			'wp-phpunit/*',
			'*-stubs',
		],
	},
};

function isObject( v ) {
	return v && typeof v === 'object' && ! Array.isArray( v );
}

/** Deep-merge source onto target (arrays replace, objects merge). */
function merge( target, source ) {
	const out = { ...target };
	for ( const [ key, val ] of Object.entries( source || {} ) ) {
		out[ key ] = isObject( val ) && isObject( target[ key ] )
			? merge( target[ key ], val )
			: val;
	}
	return out;
}

/**
 * Load config from an explicit path, or auto-discover `unused-deps.config.json`
 * at the root. Returns the merged config (defaults + file).
 */
export function loadConfig( root, explicitPath ) {
	let file = explicitPath;
	if ( ! file ) {
		const candidate = path.join( root, 'unused-deps.config.json' );
		if ( fs.existsSync( candidate ) ) {
			file = candidate;
		}
	}
	if ( ! file ) {
		return { ...DEFAULT_CONFIG, _source: 'defaults' };
	}
	const abs = path.isAbsolute( file ) ? file : path.join( root, file );
	let parsed = {};
	try {
		parsed = JSON.parse( fs.readFileSync( abs, 'utf8' ) );
	} catch ( e ) {
		throw new Error( `Cannot read config ${ abs }: ${ e.message }` );
	}
	return { ...merge( DEFAULT_CONFIG, parsed ), _source: abs };
}
