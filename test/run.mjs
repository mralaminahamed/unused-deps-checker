#!/usr/bin/env node
/**
 * Self-test — zero deps, no test runner. Builds a throwaway fixture project in
 * the OS temp dir, runs the scanners, and asserts the classifications.
 *
 * Run: node test/run.mjs   (exit 0 = pass, 1 = fail)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scanJs } from '../src/scan-js.mjs';
import { scanPhp } from '../src/scan-php.mjs';
import { DEFAULT_CONFIG } from '../src/config.mjs';
import { packageFromSpecifier } from '../src/scan-js.mjs';
import { barewordPresent } from '../src/match.mjs';

let failures = 0;
function assert( cond, msg ) {
	if ( cond ) {
		process.stdout.write( `  ✔ ${ msg }\n` );
	} else {
		failures++;
		process.stdout.write( `  ✖ ${ msg }\n` );
	}
}

function statusOf( deps, name ) {
	return deps.find( ( d ) => d.name === name )?.status;
}

// ── unit: specifier normalisation ──
process.stdout.write( 'specifier normalisation\n' );
assert( packageFromSpecifier( 'react' ) === 'react', 'bare package' );
assert( packageFromSpecifier( 'lodash/merge' ) === 'lodash', 'subpath' );
assert( packageFromSpecifier( '@wordpress/data' ) === '@wordpress/data', 'scoped' );
assert( packageFromSpecifier( '@wordpress/data/build' ) === '@wordpress/data', 'scoped subpath' );
assert( packageFromSpecifier( './local' ) === null, 'relative ignored' );
assert( packageFromSpecifier( 'node:fs' ) === 'fs', 'node protocol stripped' );

// ── unit: bareword boundaries ──
process.stdout.write( 'bareword boundaries\n' );
assert( barewordPresent( "use: 'sass-loader'", 'sass-loader' ), 'matches loader string' );
assert( ! barewordPresent( "use: 'sass-loader'", 'sass' ), 'sass does NOT match sass-loader' );
assert( ! barewordPresent( 'from "react-dom"', 'react' ), 'react does NOT match inside react-dom' );

// ── integration: build a fixture ──
const dir = fs.mkdtempSync( path.join( os.tmpdir(), 'udc-' ) );
fs.mkdirSync( path.join( dir, 'src' ), { recursive: true } );
fs.mkdirSync( path.join( dir, 'includes' ), { recursive: true } );
fs.mkdirSync( path.join( dir, 'vendor/acme/widget' ), { recursive: true } );

fs.writeFileSync(
	path.join( dir, 'package.json' ),
	JSON.stringify( {
		dependencies: {
			used: '1.0.0',
			unusedlib: '1.0.0',
			tailwindcss: '1.0.0', // via stylesheet @import
			'@fontsource/x': '1.0.0', // via stylesheet @import (scoped)
		},
		devDependencies: {
			'sass-loader': '1.0.0', // referenced in webpack config string
			'asset-only-lib': '1.0.0', // copied via asset-management config
			'never-used': '1.0.0',
			'@types/node': '1.0.0', // ignored by default
		},
		scripts: { build: 'webpack' },
	} )
);
fs.writeFileSync(
	path.join( dir, 'src/index.js' ),
	"import { thing } from 'used';\nrequire('used/sub');\n"
);
fs.writeFileSync(
	path.join( dir, 'src/app.scss' ),
	'@import "tailwindcss";\n@use "@fontsource/x/400.css";\n@use "./local";\n'
);
fs.writeFileSync(
	path.join( dir, 'webpack.config.js' ),
	"module.exports = { module: { rules: [ { use: 'sass-loader' } ] } };\n"
);
// Asset-management config (manage-asset-node_modules style) — lists pkgs by name.
fs.writeFileSync(
	path.join( dir, 'config.node_modules.json' ),
	JSON.stringify( { packages: [ { name: 'asset-only-lib', destination: 'x' } ] } )
);

// PHP fixture
fs.writeFileSync(
	path.join( dir, 'composer.json' ),
	JSON.stringify( {
		require: { php: '>=7.4', 'acme/widget': '^1.0' },
		'require-dev': { 'phpstan/phpstan': '^2.0', 'acme/orphan': '^1.0' },
	} )
);
fs.writeFileSync(
	path.join( dir, 'vendor/acme/widget/composer.json' ),
	JSON.stringify( { autoload: { 'psr-4': { 'Acme\\Widget\\': 'src/' } } } )
);
fs.writeFileSync(
	path.join( dir, 'includes/Plugin.php' ),
	"<?php\nuse Acme\\Widget\\Thing;\n$x = new Thing();\n"
);

process.stdout.write( 'JS scan\n' );
const js = scanJs( dir, DEFAULT_CONFIG.js );
assert( statusOf( js.deps, 'used' ) === 'used', 'imported dep → used' );
assert( statusOf( js.deps, 'unusedlib' ) === 'unused', 'unimported dep → unused' );
assert( statusOf( js.deps, 'sass-loader' ) === 'config', 'config-referenced dep → config' );
assert( statusOf( js.deps, 'never-used' ) === 'unused', 'no reference → unused' );
assert( statusOf( js.deps, '@types/node' ) === 'ignored', '@types/* → ignored' );
assert( statusOf( js.deps, 'tailwindcss' ) === 'used', 'stylesheet @import → used' );
assert( statusOf( js.deps, '@fontsource/x' ) === 'used', 'scoped stylesheet @use → used' );
assert( statusOf( js.deps, 'asset-only-lib' ) === 'config', 'asset-management config name → config' );

process.stdout.write( 'PHP scan\n' );
const php = scanPhp( dir, DEFAULT_CONFIG.php );
assert( statusOf( php.deps, 'php' ) === 'platform', 'php → platform' );
assert( statusOf( php.deps, 'phpstan/phpstan' ) === 'ignored', 'phpstan → ignored' );
assert( statusOf( php.deps, 'acme/widget' ) === 'used', 'namespace-used pkg → used' );
assert( statusOf( php.deps, 'acme/orphan' ) === 'unresolved', 'not-installed pkg → unresolved' );

fs.rmSync( dir, { recursive: true, force: true } );

process.stdout.write( failures === 0 ? '\nAll tests passed.\n' : `\n${ failures } test(s) failed.\n` );
process.exit( failures === 0 ? 0 : 1 );
