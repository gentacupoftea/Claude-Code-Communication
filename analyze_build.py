#!/usr/bin/env python3
import json
import re
import os
from collections import defaultdict

def analyze_js_bundle(file_path):
    """JSバンドルファイルを解析して、含まれている情報を抽出"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    results = {
        'components': [],
        'routes': [],
        'api_endpoints': [],
        'dependencies': [],
        'features': [],
        'firebase_config': None
    }
    
    # React コンポーネントのパターンを探す
    component_patterns = [
        r'function\s+([A-Z]\w+)\s*\(',
        r'const\s+([A-Z]\w+)\s*=',
        r'class\s+([A-Z]\w+)\s+extends',
    ]
    
    for pattern in component_patterns:
        matches = re.findall(pattern, content)
        results['components'].extend(matches)
    
    # APIエンドポイントを探す
    api_patterns = [
        r'fetch\s*\(\s*["\']([^"\']+)["\']',
        r'axios\.\w+\s*\(\s*["\']([^"\']+)["\']',
        r'https?://[^\s"\')]+',
    ]
    
    for pattern in api_patterns:
        matches = re.findall(pattern, content)
        results['api_endpoints'].extend(matches)
    
    # ルーティング情報を探す
    route_patterns = [
        r'path\s*[:=]\s*["\']([^"\']+)["\']',
        r'Route\s+path\s*=\s*["\']([^"\']+)["\']',
    ]
    
    for pattern in route_patterns:
        matches = re.findall(pattern, content)
        results['routes'].extend(matches)
    
    # Firebase設定を探す
    firebase_pattern = r'apiKey\s*[:=]\s*["\']([^"\']+)["\']'
    firebase_match = re.search(firebase_pattern, content)
    if firebase_match:
        # Firebase設定の周辺を抽出
        start = max(0, firebase_match.start() - 200)
        end = min(len(content), firebase_match.end() + 500)
        firebase_section = content[start:end]
        
        config = {}
        config_patterns = {
            'apiKey': r'apiKey\s*[:=]\s*["\']([^"\']+)["\']',
            'authDomain': r'authDomain\s*[:=]\s*["\']([^"\']+)["\']',
            'projectId': r'projectId\s*[:=]\s*["\']([^"\']+)["\']',
            'storageBucket': r'storageBucket\s*[:=]\s*["\']([^"\']+)["\']',
            'messagingSenderId': r'messagingSenderId\s*[:=]\s*["\']([^"\']+)["\']',
            'appId': r'appId\s*[:=]\s*["\']([^"\']+)["\']',
        }
        
        for key, pattern in config_patterns.items():
            match = re.search(pattern, firebase_section)
            if match:
                config[key] = match.group(1)
        
        if config:
            results['firebase_config'] = config
    
    # 特定の機能キーワードを探す
    feature_keywords = [
        'auth', 'login', 'signup', 'dashboard', 'chat', 'product', 
        'order', 'inventory', 'analytics', 'report', 'settings',
        'profile', 'search', 'filter', 'upload', 'download',
        'export', 'import', 'notification', 'message'
    ]
    
    for keyword in feature_keywords:
        if re.search(rf'\b{keyword}\b', content, re.IGNORECASE):
            results['features'].append(keyword)
    
    # 重複を削除
    for key in ['components', 'routes', 'api_endpoints', 'features']:
        results[key] = list(set(results[key]))
    
    return results

def analyze_css_file(file_path):
    """CSSファイルを解析して、スタイル情報を抽出"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    results = {
        'classes': [],
        'ids': [],
        'custom_properties': [],
        'media_queries': [],
        'animations': []
    }
    
    # クラス名を抽出
    class_pattern = r'\.([\w-]+)\s*\{'
    results['classes'] = re.findall(class_pattern, content)
    
    # ID を抽出
    id_pattern = r'#([\w-]+)\s*\{'
    results['ids'] = re.findall(id_pattern, content)
    
    # CSS カスタムプロパティを抽出
    custom_prop_pattern = r'--([\w-]+)\s*:'
    results['custom_properties'] = re.findall(custom_prop_pattern, content)
    
    # メディアクエリを抽出
    media_query_pattern = r'@media[^{]+\{'
    results['media_queries'] = re.findall(media_query_pattern, content)
    
    # アニメーションを抽出
    animation_pattern = r'@keyframes\s+([\w-]+)'
    results['animations'] = re.findall(animation_pattern, content)
    
    # 重複を削除
    for key in results:
        results[key] = list(set(results[key]))
    
    return results

def main():
    base_dir = '/Users/mourigenta/projects/conea-integration/restored-from-firebase-12ed7a'
    
    # JSファイルを解析
    js_file = os.path.join(base_dir, 'assets/js/index-CNvOEPAQ.js')
    js_analysis = analyze_js_bundle(js_file)
    
    # CSSファイルを解析
    css_file = os.path.join(base_dir, 'assets/css/index-BvdlortN.css')
    css_analysis = analyze_css_file(css_file)
    
    # 結果を表示
    print("=== JavaScript Bundle Analysis ===")
    print(f"Components found: {len(js_analysis['components'])}")
    if js_analysis['components'][:10]:
        print(f"  Sample: {', '.join(js_analysis['components'][:10])}")
    
    print(f"\nRoutes found: {len(js_analysis['routes'])}")
    if js_analysis['routes']:
        print(f"  Routes: {', '.join(js_analysis['routes'][:10])}")
    
    print(f"\nAPI Endpoints found: {len(js_analysis['api_endpoints'])}")
    if js_analysis['api_endpoints']:
        print(f"  Sample: {', '.join(js_analysis['api_endpoints'][:5])}")
    
    print(f"\nFeatures detected: {len(js_analysis['features'])}")
    if js_analysis['features']:
        print(f"  Features: {', '.join(js_analysis['features'])}")
    
    if js_analysis['firebase_config']:
        print("\nFirebase Configuration found:")
        for key, value in js_analysis['firebase_config'].items():
            print(f"  {key}: {value}")
    
    print("\n=== CSS Analysis ===")
    print(f"CSS Classes: {len(css_analysis['classes'])}")
    print(f"IDs: {len(css_analysis['ids'])}")
    print(f"Custom Properties: {len(css_analysis['custom_properties'])}")
    print(f"Media Queries: {len(css_analysis['media_queries'])}")
    print(f"Animations: {len(css_analysis['animations'])}")
    
    # 結果をJSONファイルに保存
    results = {
        'js_analysis': js_analysis,
        'css_analysis': css_analysis
    }
    
    output_file = os.path.join(base_dir, 'analysis_results.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print(f"\n結果を {output_file} に保存しました")

if __name__ == '__main__':
    main()