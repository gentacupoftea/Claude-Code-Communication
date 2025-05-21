#!/usr/bin/env ts-node
/**
 * Conea API ドキュメント自動生成スクリプト
 * 
 * TypeScriptのソースコードとJSDocコメントから
 * OpenAPI仕様のドキュメントを自動生成します。
 */

import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import * as ts from 'typescript';
import * as jsDocParser from 'jsdoc-parser';
import { execSync } from 'child_process';

// 設定
const SRC_DIR = path.join(__dirname, '../src');
const OUTPUT_DIR = path.join(__dirname, '../docs/api');
const OPENAPI_JSON_PATH = path.join(OUTPUT_DIR, 'openapi.json');
const OPENAPI_YAML_PATH = path.join(OUTPUT_DIR, 'openapi.yaml');
const API_HTML_PATH = path.join(OUTPUT_DIR, 'index.html');

// 基本的なOpenAPIスペック情報
const BASE_SPEC = {
  openapi: '3.0.3',
  info: {
    title: 'Conea API',
    description: 'Conea eコマース分析プラットフォームのAPI',
    version: process.env.npm_package_version || '0.3.0',
    contact: {
      name: 'Conea Support',
      url: 'https://conea.example.com/support',
      email: 'support@conea.example.com'
    },
    license: {
      name: 'PROPRIETARY',
      url: 'https://conea.example.com/license'
    }
  },
  servers: [
    {
      url: 'https://api.conea.example.com/api/v2',
      description: '本番環境 v2'
    },
    {
      url: 'https://api.conea.example.com/api/v1',
      description: '本番環境 v1 (非推奨)'
    },
    {
      url: 'https://staging-api.conea.example.com/api/v2',
      description: 'ステージング環境'
    }
  ],
  tags: [],
  paths: {},
  components: {
    schemas: {},
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      },
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key'
      }
    }
  }
};

/**
 * ルーターファイルからエンドポイント情報を抽出
 */
function extractEndpointsFromRouterFiles(): any {
  const routerFiles = glob.sync(`${SRC_DIR}/**/routes.{ts,js}`);
  const endpoints: any = {};
  
  for (const file of routerFiles) {
    const relativePath = path.relative(SRC_DIR, file);
    console.log(`Processing router file: ${relativePath}`);
    
    const fileContent = fs.readFileSync(file, 'utf8');
    
    // バージョンの抽出（ファイルパスから推測）
    const versionMatch = relativePath.match(/v(\d+)/) || ['', ''];
    const version = versionMatch[1] || 'v2'; // デフォルトはv2
    
    // エンドポイントの抽出（簡易的なパターンマッチング）
    const routeMatches = fileContent.matchAll(/router\.(get|post|put|patch|delete)\(['"]([^'"]+)['"]/g);
    
    for (const match of routeMatches) {
      const method = match[1].toLowerCase();
      let path = match[2];
      
      // パスパラメータの正規化 (:id → {id})
      path = path.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
      
      // コントローラ関数名の抽出（簡易的なパターンマッチング）
      const handlerMatch = fileContent.substring(match.index!).match(/,\s*([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)/);
      const handlerInfo = handlerMatch ? `${handlerMatch[1]}.${handlerMatch[2]}` : 'unknown';
      
      // JSDocコメントの抽出
      const jsDocMatch = fileContent.substring(0, match.index!).match(/\/\*\*([\s\S]*?)\*\/\s*$/);
      const jsDoc = jsDocMatch ? jsDocMatch[1] : '';
      
      // JSDocからの情報抽出
      const summary = extractFromJSDoc(jsDoc, '@desc') || extractFromJSDoc(jsDoc, '@description') || '';
      const deprecated = jsDoc.includes('@deprecated');
      const responses = extractResponsesFromJSDoc(jsDoc);
      const requestBody = extractRequestBodyFromJSDoc(jsDoc);
      const security = extractSecurityFromJSDoc(jsDoc);
      
      // OpenAPIのpathsオブジェクトに追加
      const fullPath = `/api/${version}${path}`;
      if (!endpoints[fullPath]) {
        endpoints[fullPath] = {};
      }
      
      endpoints[fullPath][method] = {
        summary: summary.trim(),
        description: `Handler: ${handlerInfo}`,
        tags: deriveTags(path),
        deprecated,
        ...(Object.keys(requestBody).length > 0 && { requestBody }),
        responses,
        ...(security.length > 0 && { security })
      };
    }
  }
  
  return endpoints;
}

/**
 * JSDocから特定のタグの値を抽出
 */
function extractFromJSDoc(jsDoc: string, tag: string): string {
  const match = jsDoc.match(new RegExp(`${tag}\\s+([^\\r\\n@]+)`));
  return match ? match[1].trim() : '';
}

/**
 * JSDocからレスポンス情報を抽出
 */
function extractResponsesFromJSDoc(jsDoc: string): any {
  const responses: any = {
    '200': {
      description: 'Successful operation'
    }
  };
  
  // @response タグの処理
  const responseMatches = jsDoc.matchAll(/@response\s+(\d+)\s+([^@]+)/g);
  for (const match of responseMatches) {
    const statusCode = match[1];
    const description = match[2].trim();
    responses[statusCode] = { description };
  }
  
  // 共通エラーレスポンスの追加
  if (!responses['400']) {
    responses['400'] = { description: 'Bad request' };
  }
  
  if (!responses['401']) {
    responses['401'] = { description: 'Unauthorized' };
  }
  
  if (!responses['500']) {
    responses['500'] = { description: 'Internal server error' };
  }
  
  return responses;
}

/**
 * JSDocからリクエストボディ情報を抽出
 */
function extractRequestBodyFromJSDoc(jsDoc: string): any {
  const requestBody: any = {};
  
  // @body タグの処理
  const bodyMatch = jsDoc.match(/@body\s+([^@]+)/);
  if (bodyMatch) {
    requestBody.content = {
      'application/json': {
        schema: {
          type: 'object',
          description: bodyMatch[1].trim()
        }
      }
    };
    requestBody.required = true;
  }
  
  return requestBody;
}

/**
 * JSDocからセキュリティ情報を抽出
 */
function extractSecurityFromJSDoc(jsDoc: string): any[] {
  const security: any[] = [];
  
  if (jsDoc.includes('@auth') || jsDoc.includes('@authenticated')) {
    security.push({ BearerAuth: [] });
  }
  
  if (jsDoc.includes('@apikey')) {
    security.push({ ApiKeyAuth: [] });
  }
  
  return security;
}

/**
 * パスからタグを導出（例: /users/* → ["users"]）
 */
function deriveTags(path: string): string[] {
  const segments = path.split('/').filter(Boolean);
  if (segments.length > 0) {
    const firstSegment = segments[0];
    return [firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1)];
  }
  return ['General'];
}

/**
 * エンティティモデルからスキーマ定義を抽出
 */
function extractSchemasFromModels(): any {
  const schemas: any = {};
  const modelFiles = glob.sync(`${SRC_DIR}/**/models/*.{ts,js}`);
  
  for (const file of modelFiles) {
    const relativePath = path.relative(SRC_DIR, file);
    console.log(`Processing model file: ${relativePath}`);
    
    const fileContent = fs.readFileSync(file, 'utf8');
    const sourceFile = ts.createSourceFile(
      file,
      fileContent,
      ts.ScriptTarget.ES2020,
      /*setParentNodes */ true
    );
    
    // TypeScriptのAST解析でクラスとインターフェースを抽出
    ts.forEachChild(sourceFile, node => {
      if (ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)) {
        const name = node.name?.text;
        if (name) {
          const schema = extractSchemaFromNode(node);
          schemas[name] = schema;
        }
      }
    });
  }
  
  return schemas;
}

/**
 * TypeScriptのノードからスキーマ定義を抽出
 */
function extractSchemaFromNode(node: ts.ClassDeclaration | ts.InterfaceDeclaration): any {
  const schema: any = {
    type: 'object',
    properties: {}
  };
  
  // JSDocからの説明の抽出
  const nodeStart = node.getStart();
  const nodeText = node.getSourceFile().text;
  const comments = ts.getLeadingCommentRanges(nodeText, nodeStart) || [];
  
  if (comments.length > 0) {
    const commentText = nodeText.substring(comments[0].pos, comments[0].end);
    const descMatch = commentText.match(/@description\s+([^@]+)/);
    if (descMatch) {
      schema.description = descMatch[1].trim();
    }
  }
  
  // プロパティの抽出
  const members = node.members;
  const requiredProps: string[] = [];
  
  members.forEach(member => {
    if (ts.isPropertyDeclaration(member) || ts.isPropertySignature(member)) {
      const propertyName = member.name.getText();
      const propertyType = member.type ? member.type.getText() : 'any';
      const isOptional = member.questionToken !== undefined;
      
      if (!isOptional) {
        requiredProps.push(propertyName);
      }
      
      // JSDocコメントの抽出
      const memberStart = member.getStart();
      const memberComments = ts.getLeadingCommentRanges(nodeText, memberStart) || [];
      let description = '';
      
      if (memberComments.length > 0) {
        const commentText = nodeText.substring(memberComments[0].pos, memberComments[0].end);
        const descMatch = commentText.match(/@description\s+([^@]+)/);
        if (descMatch) {
          description = descMatch[1].trim();
        }
      }
      
      // TypeScriptの型をOpenAPIスキーマ型に変換
      schema.properties[propertyName] = typeScriptToOpenAPI(propertyType, description);
    }
  });
  
  if (requiredProps.length > 0) {
    schema.required = requiredProps;
  }
  
  return schema;
}

/**
 * TypeScript型をOpenAPIスキーマ型に変換
 */
function typeScriptToOpenAPI(type: string, description: string): any {
  // 基本型の変換
  const typeMap: any = {
    'string': { type: 'string' },
    'number': { type: 'number' },
    'boolean': { type: 'boolean' },
    'any': { type: 'object' },
    'Date': { type: 'string', format: 'date-time' },
    'Buffer': { type: 'string', format: 'binary' }
  };
  
  // 配列の処理
  if (type.includes('[]')) {
    const itemType = type.replace('[]', '').trim();
    return {
      type: 'array',
      items: typeScriptToOpenAPI(itemType, ''),
      description
    };
  }
  
  // マップ/レコード型の処理
  if (type.includes('Record<') || type.includes('Map<')) {
    return {
      type: 'object',
      additionalProperties: true,
      description
    };
  }
  
  // ユニオン型の処理（簡易的）
  if (type.includes('|')) {
    const types = type.split('|').map(t => t.trim());
    if (types.includes('null') || types.includes('undefined')) {
      const nonNullTypes = types.filter(t => t !== 'null' && t !== 'undefined');
      if (nonNullTypes.length === 1) {
        return {
          ...typeScriptToOpenAPI(nonNullTypes[0], ''),
          nullable: true,
          description
        };
      }
    }
    
    return {
      oneOf: types.map(t => typeScriptToOpenAPI(t, '')),
      description
    };
  }
  
  // 対応する基本型がある場合はそれを返す
  if (typeMap[type]) {
    return {
      ...typeMap[type],
      ...(description && { description })
    };
  }
  
  // その他は参照型として扱う
  return {
    $ref: `#/components/schemas/${type}`,
    ...(description && { description })
  };
}

/**
 * OpenAPIドキュメントの生成
 */
async function generateOpenApiSpec() {
  try {
    // 出力ディレクトリの作成
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    
    console.log('Extracting endpoints from router files...');
    const paths = extractEndpointsFromRouterFiles();
    
    console.log('Extracting schemas from model files...');
    const schemas = extractSchemasFromModels();
    
    // タグの集約
    const tags = new Set<string>();
    for (const path in paths) {
      for (const method in paths[path]) {
        paths[path][method].tags.forEach((tag: string) => tags.add(tag));
      }
    }
    
    // 最終的なOpenAPIスペックの構築
    const spec = {
      ...BASE_SPEC,
      tags: Array.from(tags).map(tag => ({ name: tag })),
      paths,
      components: {
        ...BASE_SPEC.components,
        schemas
      }
    };
    
    // JSONとして保存
    fs.writeFileSync(
      OPENAPI_JSON_PATH,
      JSON.stringify(spec, null, 2)
    );
    console.log(`OpenAPI JSON saved to: ${OPENAPI_JSON_PATH}`);
    
    // YAMLへの変換（オプション）
    try {
      const yaml = require('js-yaml');
      fs.writeFileSync(
        OPENAPI_YAML_PATH,
        yaml.dump(spec)
      );
      console.log(`OpenAPI YAML saved to: ${OPENAPI_YAML_PATH}`);
    } catch (error) {
      console.warn('Could not generate YAML version:', error);
    }
    
    // HTMLドキュメントの生成（Swagger UIベース）
    generateHtmlDocs();
    
    return spec;
  } catch (error) {
    console.error('Error generating OpenAPI spec:', error);
    throw error;
  }
}

/**
 * HTMLドキュメントの生成
 */
function generateHtmlDocs() {
  try {
    // Swagger UI テンプレート
    const htmlTemplate = `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <title>Conea API 仕様書</title>
      <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@4.5.0/swagger-ui.css" />
      <style>
        body { margin: 0; padding: 0; }
        .swagger-ui .topbar { display: none; }
        .swagger-ui .info { margin: 20px 0; }
        .swagger-ui .info .title { color: #006CB7; }
      </style>
    </head>
    <body>
      <div id="swagger-ui"></div>
      <script src="https://unpkg.com/swagger-ui-dist@4.5.0/swagger-ui-bundle.js"></script>
      <script>
        window.onload = function() {
          window.ui = SwaggerUIBundle({
            url: './openapi.json',
            dom_id: '#swagger-ui',
            deepLinking: true,
            presets: [SwaggerUIBundle.presets.apis],
            plugins: [SwaggerUIBundle.plugins.DownloadUrl],
            layout: 'BaseLayout',
            defaultModelsExpandDepth: -1
          });
        };
      </script>
    </body>
    </html>
    `;
    
    fs.writeFileSync(API_HTML_PATH, htmlTemplate);
    console.log(`API documentation HTML saved to: ${API_HTML_PATH}`);
    
  } catch (error) {
    console.error('Error generating HTML documentation:', error);
  }
}

// スクリプト実行
console.log('Generating API documentation...');
generateOpenApiSpec()
  .then(() => {
    console.log('API documentation generation completed successfully.');
  })
  .catch(error => {
    console.error('Failed to generate API documentation:', error);
    process.exit(1);
  });