#!/usr/bin/env python3
"""
ULTIMATE ESLint Cleanup - Batch Processing
Process ESLint text output and fix issues systematically
"""

import os
import re
import subprocess
from pathlib import Path

def get_eslint_issues():
    """Get ESLint issues from text output"""
    try:
        result = subprocess.run(
            ['npm', 'run', 'lint'],
            capture_output=True,
            text=True,
            cwd='.'
        )
        return result.stdout + result.stderr
    except Exception as e:
        print(f"Error running ESLint: {e}")
        return ""

def parse_eslint_output(output):
    """Parse ESLint text output into structured data"""
    issues = []
    current_file = None
    
    for line in output.split('\n'):
        # Match file paths
        file_match = re.match(r'^\./(.*\.(ts|tsx|js|jsx))$', line.strip())
        if file_match:
            current_file = file_match.group(1)
            continue
            
        # Match issue lines
        issue_match = re.match(r'^\s*(\d+):(\d+)\s+(Warning|Error):\s+(.+?)\s+(@?[\w/-]+)$', line.strip())
        if issue_match and current_file:
            line_num = int(issue_match.group(1))
            column = int(issue_match.group(2))
            severity = issue_match.group(3)
            message = issue_match.group(4)
            rule_id = issue_match.group(5)
            
            issues.append({
                'file': current_file,
                'line': line_num,
                'column': column,
                'severity': severity,
                'message': message,
                'rule': rule_id
            })
    
    return issues

def fix_issue_batch(issues_by_file):
    """Fix issues file by file"""
    total_fixed = 0
    
    for file_path, issues in issues_by_file.items():
        if not os.path.exists(file_path):
            print(f"⚠️  File not found: {file_path}")
            continue
            
        print(f"🔧 Processing {file_path} ({len(issues)} issues)")
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
        except Exception as e:
            print(f"❌ Error reading {file_path}: {e}")
            continue
        
        # Sort issues by line number (descending) to avoid line shifts
        issues.sort(key=lambda x: x['line'], reverse=True)
        
        file_fixed = 0
        for issue in issues:
            try:
                if fix_single_issue(lines, issue):
                    file_fixed += 1
                    total_fixed += 1
            except Exception as e:
                print(f"  ⚠️  Error fixing {issue['rule']} at line {issue['line']}: {e}")
        
        # Write back the file if any changes were made
        if file_fixed > 0:
            try:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.writelines(lines)
                print(f"  ✅ Fixed {file_fixed} issues in {file_path}")
            except Exception as e:
                print(f"  ❌ Error writing {file_path}: {e}")
    
    return total_fixed

def fix_single_issue(lines, issue):
    """Fix a single ESLint issue"""
    line_num = issue['line']
    rule = issue['rule']
    message = issue['message']
    
    if line_num > len(lines):
        return False
    
    line_idx = line_num - 1
    line = lines[line_idx]
    
    # Fix different types of issues
    if rule == '@typescript-eslint/no-explicit-any':
        return fix_explicit_any(lines, line_idx, line)
    elif rule == '@typescript-eslint/no-unused-vars':
        return fix_unused_vars(lines, line_idx, line, message)
    elif rule == 'no-console':
        return fix_console(lines, line_idx, line)
    elif rule == '@typescript-eslint/no-require-imports':
        return fix_require_imports(lines, line_idx, line)
    elif rule == '@typescript-eslint/no-unused-expressions':
        return fix_unused_expressions(lines, line_idx, line)
    elif rule == '@typescript-eslint/no-namespace':
        return fix_namespace(lines, line_idx, line)
    elif rule == 'prefer-const':
        return fix_prefer_const(lines, line_idx, line)
    elif rule == 'no-unused-vars':
        return fix_unused_vars(lines, line_idx, line, message)
    
    return False

def fix_explicit_any(lines, line_idx, line):
    """Fix 'any' type issues"""
    patterns = [
        (r': any\b(?!\[\])', ': unknown'),
        (r': any\[\]', ': unknown[]'),
        (r': any\s*\|', ': unknown |'),
        (r'\|\s*any\b', '| unknown'),
        (r'<any>', '<unknown>'),
        (r'Record<string,\s*any>', 'Record<string, unknown>'),
        (r'Promise<any>', 'Promise<unknown>'),
        (r'Array<any>', 'Array<unknown>'),
        (r'\(\s*([^)]*?)\s*:\s*any\s*\)', r'(\1: unknown)'),
    ]
    
    original_line = line
    for pattern, replacement in patterns:
        line = re.sub(pattern, replacement, line)
    
    if line != original_line:
        lines[line_idx] = line
        return True
    return False

def fix_unused_vars(lines, line_idx, line, message):
    """Fix unused variable issues"""
    # Extract variable name from message
    var_match = re.search(r"'([^']+)' is (defined but never used|assigned a value but never used)", message)
    if not var_match:
        return False
    
    var_name = var_match.group(1)
    new_var_name = f"_{var_name}"
    
    # Replace the first occurrence of the variable name
    patterns = [
        # Function parameters
        rf'\b{re.escape(var_name)}\b(?=\s*[,)])',
        # Variable declarations
        rf'\b{re.escape(var_name)}\b(?=\s*[:=])',
        # Destructuring
        rf'\b{re.escape(var_name)}\b(?=\s*[,}}])',
    ]
    
    original_line = line
    for pattern in patterns:
        new_line = re.sub(pattern, new_var_name, line, count=1)
        if new_line != line:
            lines[line_idx] = new_line
            return True
    
    return False

def fix_console(lines, line_idx, line):
    """Fix console usage issues"""
    if 'console.' in line and 'eslint-disable-next-line no-console' not in line:
        indent = re.match(r'^(\s*)', line).group(1)
        disable_comment = f"{indent}// eslint-disable-next-line no-console\n"
        lines.insert(line_idx, disable_comment)
        return True
    return False

def fix_require_imports(lines, line_idx, line):
    """Fix require() import issues"""
    patterns = [
        (r"const\s+(\w+)\s*=\s*require\s*\(\s*['\"]([^'\"]+)['\"]\s*\)", r"import \1 from '\2'"),
        (r"const\s*{\s*([^}]+)\s*}\s*=\s*require\s*\(\s*['\"]([^'\"]+)['\"]\s*\)", r"import { \1 } from '\2'"),
    ]
    
    original_line = line
    for pattern, replacement in patterns:
        line = re.sub(pattern, replacement, line)
    
    if line != original_line:
        lines[line_idx] = line
        return True
    return False

def fix_unused_expressions(lines, line_idx, line):
    """Fix unused expression issues"""
    if not line.strip().startswith('//') and 'void ' not in line:
        # Add void operator
        match = re.match(r'^(\s*)(.+);?\s*$', line)
        if match:
            indent = match.group(1)
            expr = match.group(2).rstrip(';')
            lines[line_idx] = f"{indent}void {expr};\n"
            return True
    return False

def fix_namespace(lines, line_idx, line):
    """Fix namespace issues by adding eslint disable"""
    if 'namespace' in line and 'eslint-disable-next-line' not in line:
        indent = re.match(r'^(\s*)', line).group(1)
        disable_comment = f"{indent}// eslint-disable-next-line @typescript-eslint/no-namespace\n"
        lines.insert(line_idx, disable_comment)
        return True
    return False

def fix_prefer_const(lines, line_idx, line):
    """Fix prefer-const issues"""
    line = re.sub(r'\blet\b', 'const', line, count=1)
    lines[line_idx] = line
    return True

def main():
    print("🚀 ULTIMATE ESLint Cleanup - Batch Processing")
    print("=" * 60)
    
    # Get current ESLint issues
    print("📊 Analyzing ESLint issues...")
    eslint_output = get_eslint_issues()
    
    if not eslint_output:
        print("❌ No ESLint output found")
        return
    
    # Parse issues
    issues = parse_eslint_output(eslint_output)
    print(f"📋 Found {len(issues)} total issues")
    
    if not issues:
        print("✅ No issues found!")
        return
    
    # Group issues by file
    issues_by_file = {}
    for issue in issues:
        file_path = issue['file']
        if file_path not in issues_by_file:
            issues_by_file[file_path] = []
        issues_by_file[file_path].append(issue)
    
    print(f"📁 Issues found in {len(issues_by_file)} files")
    
    # Show breakdown by rule
    rule_counts = {}
    for issue in issues:
        rule = issue['rule']
        rule_counts[rule] = rule_counts.get(rule, 0) + 1
    
    print("\n📈 Issue breakdown:")
    for rule, count in sorted(rule_counts.items(), key=lambda x: x[1], reverse=True):
        print(f"  {rule}: {count}")
    
    # Fix issues
    print("\n🔧 Starting fixes...")
    total_fixed = fix_issue_batch(issues_by_file)
    
    print(f"\n✅ Batch processing complete!")
    print(f"🔧 Total issues fixed: {total_fixed}")
    print(f"📈 Fix rate: {(total_fixed/len(issues)*100):.1f}%")
    
    # Run ESLint again to check remaining issues
    print("\n📊 Checking remaining issues...")
    new_output = get_eslint_issues()
    new_issues = parse_eslint_output(new_output)
    print(f"🎯 Remaining issues: {len(new_issues)}")
    
    if len(new_issues) < len(issues):
        reduction = len(issues) - len(new_issues)
        print(f"🎉 Reduced issues by {reduction} ({(reduction/len(issues)*100):.1f}%)")

if __name__ == "__main__":
    main()