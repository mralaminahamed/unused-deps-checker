#!/usr/bin/env node
/**
 * unused-deps-checker — find package.json + composer.json dependencies that are
 * never imported or referenced.
 *
 * Zero runtime dependencies. Node 18+.
 *
 * Usage:
 *   node bin/check-deps.mjs [--root <dir>] [--config <file>] [options]
 *
 * Options:
 *   --root <dir>      Project root to scan          (default: cwd)
 *   --config <file>   JSON config                   (default: <root>/unused-deps.config.json)
 *   --js-only         Scan package.json only
 *   --php-only        Scan composer.json only
 *   --json            Emit machine-readable JSON
 *   --strict          Exit 1 when any unused dependency is found
 *   --no-color        Disable ANSI colour
 *   -h, --help        Show this help
 */

import path from 'node:path';
import process from 'node:process';
import { loadConfig } from '../src/config.mjs';
import { scanJs } from '../src/scan-js.mjs';
import { scanPhp } from '../src/scan-php.mjs';
import { printEcosystem, printJson } from '../src/report.mjs';

function parseArgs( argv ) {
	const opts = {
		root: process.cwd(),
		config: null,
		js: true,
		php: true,
		json: false,
		strict: false,
		color: process.stdout.isTTY,
		help: false,
	};
	for ( let i = 0; i < argv.length; i++ ) {
		const a = argv[ i ];
		switch ( a ) {
			case '--root': opts.root = path.resolve( argv[ ++i ] ); break;
			case '--config': opts.config = argv[ ++i ]; break;
			case '--js-only': opts.php = false; break;
			case '--php-only': opts.js = false; break;
			case '--json': opts.json = true; opts.color = false; break;
			case '--strict': opts.strict = true; break;
			case '--no-color': opts.color = false; break;
			case '-h':
			case '--help': opts.help = true; break;
			default:
				if ( a.startsWith( '-' ) ) {
					process.stderr.write( `Unknown option: ${ a }\n` );
					process.exit( 2 );
				}
		}
	}
	return opts;
}

const HELP = `unused-deps-checker — find unused package.json + composer.json deps

Usage:
  check-deps [--root <dir>] [--config <file>] [--js-only|--php-only] [--json] [--strict]

Options:
  --root <dir>     Project root to scan        (default: cwd)
  --config <file>  JSON config file            (default: <root>/unused-deps.config.json)
  --js-only        Scan package.json only
  --php-only       Scan composer.json only
  --json           Machine-readable JSON output
  --strict         Exit 1 if any unused dependency is found
  --no-color       Disable ANSI colour
  -h, --help       Show this help
`;

function main() {
	const opts = parseArgs( process.argv.slice( 2 ) );
	if ( opts.help ) {
		process.stdout.write( HELP );
		return;
	}

	const out = ( line ) => process.stdout.write( `${ line }\n` );
	const cfg = loadConfig( opts.root, opts.config );

	const jsResult = opts.js && cfg.js?.enabled !== false ? scanJs( opts.root, cfg.js ) : null;
	const phpResult = opts.php && cfg.php?.enabled !== false ? scanPhp( opts.root, cfg.php ) : null;

	if ( opts.json ) {
		printJson(
			{
				root: opts.root,
				config: cfg._source,
				js: jsResult,
				php: phpResult,
			},
			out
		);
	} else {
		out( '' );
		out( `unused-deps-checker  ·  root: ${ opts.root }` );
		out( `config: ${ cfg._source }` );
	}

	let unusedTotal = 0;
	const reportOpts = { color: opts.color, out };
	if ( jsResult && ! opts.json ) {
		unusedTotal += printEcosystem( 'JavaScript (package.json)', jsResult, reportOpts ).length;
	}
	if ( phpResult && ! opts.json ) {
		unusedTotal += printEcosystem( 'PHP (composer.json)', phpResult, reportOpts ).length;
	}
	if ( opts.json ) {
		unusedTotal =
			( jsResult?.deps.filter( ( d ) => d.status === 'unused' ).length || 0 ) +
			( phpResult?.deps.filter( ( d ) => d.status === 'unused' ).length || 0 );
	}

	if ( ! opts.json ) {
		out( '' );
		out(
			unusedTotal === 0
				? '✔ No unused dependencies found.'
				: `✖ ${ unusedTotal } potentially unused dependenc${ unusedTotal === 1 ? 'y' : 'ies' } — verify before removing.`
		);
		out( '' );
	}

	if ( opts.strict && unusedTotal > 0 ) {
		process.exit( 1 );
	}
}

main();
