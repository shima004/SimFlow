// Script to fetch Argo Workflows Swagger 2.x spec, convert to OpenAPI 3.x,
// and generate TypeScript types using openapi-typescript.
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { createRequire } from 'module';

const SWAGGER_URL =
	'https://raw.githubusercontent.com/argoproj/argo-workflows/main/api/openapi-spec/swagger.json';
const TMP_OPENAPI = '/tmp/argo-openapi3.json';
const OUTPUT = 'src/lib/api/schema.d.ts';

const require = createRequire(import.meta.url);
const converter = require('swagger2openapi');

console.log('Fetching Argo Workflows Swagger spec...');
const res = await fetch(SWAGGER_URL);
if (!res.ok) throw new Error(`Failed to fetch spec: ${res.status}`);
const swagger = await res.json();

console.log('Converting Swagger 2.x to OpenAPI 3.x...');
const { openapi } = await new Promise((resolve, reject) => {
	converter.convertObj(swagger, { anchors: true }, (err, result) => {
		if (err) reject(err);
		else resolve(result);
	});
});

writeFileSync(TMP_OPENAPI, JSON.stringify(openapi));

console.log('Generating TypeScript types...');
execSync(`npx openapi-typescript ${TMP_OPENAPI} -o ${OUTPUT}`, { stdio: 'inherit' });

unlinkSync(TMP_OPENAPI);
console.log(`Done! Types written to ${OUTPUT}`);
