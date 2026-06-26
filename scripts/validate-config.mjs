#!/usr/bin/env node
/**
 * Validate a config file against schema/config.schema.json.
 *
 * Zero dependencies — a compact validator for the JSON Schema subset the schema
 * actually uses (type, properties, additionalProperties, required, items,
 * pattern, enum). Not a general-purpose draft-07 implementation.
 *
 * Usage: node scripts/validate-config.mjs [config.json]
 *        (defaults to unused-deps.config.sample.json)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname( fileURLToPath( import.meta.url ) );
const root = path.join( here, '..' );
const schemaPath = path.join( root, 'schema', 'config.schema.json' );
const target = process.argv[ 2 ]
	? path.resolve( process.argv[ 2 ] )
	: path.join( root, 'unused-deps.config.sample.json' );

const errors = [];

function typeOf( v ) {
	if ( Array.isArray( v ) ) {
		return 'array';
	}
	if ( v === null ) {
		return 'null';
	}
	return typeof v; // object | string | number | boolean
}

function validate( value, schema, pointer ) {
	if ( schema.type && typeOf( value ) !== schema.type ) {
		errors.push( `${ pointer }: expected ${ schema.type }, got ${ typeOf( value ) }` );
		return;
	}
	if ( schema.enum && ! schema.enum.includes( value ) ) {
		errors.push( `${ pointer }: ${ JSON.stringify( value ) } not in [${ schema.enum.join( ', ' ) }]` );
	}
	if ( schema.type === 'string' && schema.pattern ) {
		if ( ! new RegExp( schema.pattern ).test( value ) ) {
			errors.push( `${ pointer }: "${ value }" does not match /${ schema.pattern }/` );
		}
	}
	if ( schema.type === 'array' && schema.items ) {
		value.forEach( ( item, i ) => validate( item, schema.items, `${ pointer }[${ i }]` ) );
	}
	if ( schema.type === 'object' || schema.properties ) {
		const props = schema.properties || {};
		for ( const req of schema.required || [] ) {
			if ( ! ( req in value ) ) {
				errors.push( `${ pointer }: missing required property "${ req }"` );
			}
		}
		for ( const [ key, val ] of Object.entries( value ) ) {
			const sub = `${ pointer }/${ key }`;
			if ( props[ key ] ) {
				validate( val, props[ key ], sub );
			} else if ( schema.additionalProperties === false ) {
				errors.push( `${ sub }: unknown property "${ key }"` );
			}
		}
	}
}

let schema;
let config;
try {
	schema = JSON.parse( fs.readFileSync( schemaPath, 'utf8' ) );
} catch ( e ) {
	process.stderr.write( `Cannot read schema: ${ e.message }\n` );
	process.exit( 2 );
}
try {
	config = JSON.parse( fs.readFileSync( target, 'utf8' ) );
} catch ( e ) {
	process.stderr.write( `Cannot read config ${ target }: ${ e.message }\n` );
	process.exit( 2 );
}

validate( config, schema, '#' );

if ( errors.length === 0 ) {
	process.stdout.write( `✔ ${ path.basename( target ) } is valid against config.schema.json\n` );
	process.exit( 0 );
}
process.stdout.write( `✖ ${ path.basename( target ) } failed validation:\n` );
for ( const e of errors ) {
	process.stdout.write( `  - ${ e }\n` );
}
process.exit( 1 );
