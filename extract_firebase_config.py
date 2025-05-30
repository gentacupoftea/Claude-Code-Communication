#!/usr/bin/env python3
import re
import json
import os

def extract_firebase_and_components(file_path):
    """ビルドファイルからFirebase設定と主要なコンポーネントを抽出"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    results = {
        'firebase_config': {},
        'main_components': [],
        'routes': [],
        'api_calls': [],
        'auth_flow': [],
        'features': {}
    }
    
    # Firebase設定をより詳細に探す
    firebase_patterns = {
        'apiKey': r'apiKey["\s:]+["\'](AIza[^"\']+)["\']',
        'authDomain': r'authDomain["\s:]+["\']([\w\-]+\.firebaseapp\.com)["\']',
        'projectId': r'projectId["\s:]+["\']([\w\-]+)["\']',
        'storageBucket': r'storageBucket["\s:]+["\']([\w\-]+\.appspot\.com)["\']',
        'messagingSenderId': r'messagingSenderId["\s:]+["\']([\d]+)["\']',
        'appId': r'appId["\s:]+["\']([\d:]+)["\']',
    }
    
    for key, pattern in firebase_patterns.items():
        matches = re.findall(pattern, content)
        if matches:
            results['firebase_config'][key] = matches[0]
    
    # 主要なコンポーネント名を探す（より具体的なパターン）
    component_patterns = [
        r'(Login|SignIn|Auth)[^a-z]\w*',
        r'(Dashboard|Home|Main)[^a-z]\w*',
        r'(Product|Item|Inventory)[^a-z]\w*',
        r'(Order|Purchase|Cart)[^a-z]\w*',
        r'(Chat|Message|Support)[^a-z]\w*',
        r'(Settings|Profile|Config)[^a-z]\w*',
        r'(Report|Analytics|Stats)[^a-z]\w*',
    ]
    
    for pattern in component_patterns:
        matches = re.findall(pattern, content, re.IGNORECASE)
        results['main_components'].extend(matches)
    
    # ルーティング情報をより詳しく探す
    route_patterns = [
        r'path["\s:]+["\'](/[\w\-/]+)["\']',
        r'route["\s:]+["\'](/[\w\-/]+)["\']',
        r'to["\s:]+["\'](/[\w\-/]+)["\']',
    ]
    
    for pattern in route_patterns:
        matches = re.findall(pattern, content)
        results['routes'].extend(matches)
    
    # API呼び出しを探す
    api_patterns = [
        r'fetch\(["\']([^"\']+)["\']',
        r'axios\.\w+\(["\']([^"\']+)["\']',
        r'https://[\w\-\.]+\.com/[\w\-/]+',
    ]
    
    for pattern in api_patterns:
        matches = re.findall(pattern, content)
        results['api_calls'].extend(matches)
    
    # 認証フローの要素を探す
    auth_patterns = [
        r'(signIn|login|authenticate)\w*',
        r'(signUp|register|createUser)\w*',
        r'(signOut|logout)\w*',
        r'(resetPassword|forgotPassword)\w*',
        r'(verifyEmail|confirmEmail)\w*',
    ]
    
    for pattern in auth_patterns:
        matches = re.findall(pattern, content, re.IGNORECASE)
        results['auth_flow'].extend(matches)
    
    # 機能ごとのキーワードを探す
    features = {
        'ecommerce': ['product', 'cart', 'order', 'payment', 'checkout', 'inventory'],
        'chat': ['message', 'chat', 'conversation', 'thread', 'reply'],
        'analytics': ['analytics', 'report', 'dashboard', 'metrics', 'stats'],
        'user_management': ['user', 'profile', 'settings', 'account', 'permission'],
        'support': ['support', 'ticket', 'help', 'faq', 'contact'],
    }
    
    for feature, keywords in features.items():
        count = 0
        for keyword in keywords:
            if re.search(rf'\b{keyword}\b', content, re.IGNORECASE):
                count += 1
        if count > 0:
            results['features'][feature] = count
    
    # 重複を削除
    for key in ['main_components', 'routes', 'api_calls', 'auth_flow']:
        results[key] = list(set(results[key]))
    
    return results

def extract_readable_code_segments(file_path, output_dir):
    """読みやすいコードセグメントを抽出"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # コードを少し整形
    formatted = content
    
    # 一部のパターンを改行で分割
    patterns = [
        (r'}\s*function', '}\n\nfunction'),
        (r'}\s*const', '}\n\nconst'),
        (r'}\s*let', '}\n\nlet'),
        (r'}\s*var', '}\n\nvar'),
        (r';\s*const', ';\nconst'),
        (r';\s*let', ';\nlet'),
        (r';\s*var', ';\nvar'),
    ]
    
    for pattern, replacement in patterns:
        formatted = re.sub(pattern, replacement, formatted)
    
    # 特定の関数定義を抽出
    function_pattern = r'(function\s+\w+\s*\([^)]*\)\s*\{[^}]+\})'
    functions = re.findall(function_pattern, formatted)
    
    # コンポーネント定義を抽出
    component_pattern = r'(const\s+[A-Z]\w+\s*=\s*\([^)]*\)\s*=>\s*\{[^}]+\})'
    components = re.findall(component_pattern, formatted)
    
    # 結果を保存
    os.makedirs(output_dir, exist_ok=True)
    
    with open(os.path.join(output_dir, 'extracted_functions.js'), 'w') as f:
        f.write('// Extracted Functions\n\n')
        for func in functions[:20]:  # 最初の20個のみ
            f.write(func + '\n\n')
    
    with open(os.path.join(output_dir, 'extracted_components.js'), 'w') as f:
        f.write('// Extracted Components\n\n')
        for comp in components[:20]:  # 最初の20個のみ
            f.write(comp + '\n\n')
    
    return len(functions), len(components)

def main():
    base_dir = '/Users/mourigenta/projects/conea-integration/restored-from-firebase-12ed7a'
    js_file = os.path.join(base_dir, 'assets/js/index-CNvOEPAQ.js')
    
    # 詳細な解析
    results = extract_firebase_and_components(js_file)
    
    # 読みやすいコードセグメントを抽出
    extracted_dir = os.path.join(base_dir, 'extracted')
    func_count, comp_count = extract_readable_code_segments(js_file, extracted_dir)
    
    # 結果を表示
    print("=== Firebase Configuration ===")
    if results['firebase_config']:
        for key, value in results['firebase_config'].items():
            print(f"{key}: {value}")
    else:
        print("Firebase configuration not found")
    
    print("\n=== Main Components ===")
    print(f"Found {len(results['main_components'])} component references")
    if results['main_components']:
        print(f"Components: {', '.join(results['main_components'][:10])}")
    
    print("\n=== Routes ===")
    print(f"Found {len(results['routes'])} routes")
    if results['routes']:
        print(f"Routes: {', '.join(results['routes'])}")
    
    print("\n=== Authentication Flow ===")
    print(f"Found {len(results['auth_flow'])} auth-related functions")
    if results['auth_flow']:
        print(f"Auth functions: {', '.join(results['auth_flow'][:10])}")
    
    print("\n=== Features Detected ===")
    for feature, count in results['features'].items():
        print(f"{feature}: {count} keywords found")
    
    print(f"\n=== Code Extraction ===")
    print(f"Extracted {func_count} functions")
    print(f"Extracted {comp_count} components")
    print(f"Saved to: {extracted_dir}")
    
    # 詳細な結果をJSON保存
    output_file = os.path.join(base_dir, 'detailed_analysis.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print(f"\n詳細な解析結果を {output_file} に保存しました")

if __name__ == '__main__':
    main()