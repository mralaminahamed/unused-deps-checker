/**
 * Human + JSON reporting.
 */

const COLOR = {
	reset: '\x1b[0m',
	dim: '\x1b[2m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	cyan: '\x1b[36m',
	bold: '\x1b[1m',
};

function paint( on, color, str ) {
	return on ? `${ color }${ str }${ COLOR.reset }` : str;
}

function summarize( deps ) {
	const counts = {};
	for ( const d of deps ) {
		counts[ d.status ] = ( counts[ d.status ] || 0 ) + 1;
	}
	return counts;
}

/** Print one ecosystem block. Returns the list of unused dep names. */
export function printEcosystem( label, result, opts ) {
	const { color, out } = opts;
	const deps = result.deps;
	out( '' );
	out( paint( color, COLOR.bold + COLOR.cyan, `── ${ label } ──` ) );

	if ( result.stats?.skipped ) {
		out( paint( color, COLOR.dim, `   skipped: ${ result.stats.skipped }` ) );
		return [];
	}

	const unused = deps.filter( ( d ) => d.status === 'unused' );
	const counts = summarize( deps );

	const order = [ 'unused', 'unresolved', 'config', 'used', 'ignored', 'platform' ];
	const labels = {
		unused: paint( color, COLOR.red, 'UNUSED' ),
		unresolved: paint( color, COLOR.yellow, 'UNRESOLVED' ),
		config: paint( color, COLOR.dim, 'config-ref' ),
		used: paint( color, COLOR.green, 'used' ),
		ignored: paint( color, COLOR.dim, 'ignored' ),
		platform: paint( color, COLOR.dim, 'platform' ),
	};

	// Show unused + unresolved in detail; collapse the rest into counts.
	for ( const status of [ 'unused', 'unresolved' ] ) {
		for ( const d of deps.filter( ( x ) => x.status === status ) ) {
			out(
				`   ${ labels[ status ] }  ${ paint( color, COLOR.bold, d.name ) } ` +
					paint( color, COLOR.dim, `(${ d.section }) — ${ d.reason }` )
			);
		}
	}

	const summary = order
		.filter( ( s ) => counts[ s ] )
		.map( ( s ) => `${ labels[ s ] }:${ counts[ s ] }` )
		.join( '  ' );
	out(
		paint( color, COLOR.dim, `   files scanned: ${ result.stats?.filesScanned ?? 0 }` ) +
			`   ${ summary }`
	);

	return unused.map( ( d ) => d.name );
}

export function printJson( payload, out ) {
	out( JSON.stringify( payload, null, 2 ) );
}
