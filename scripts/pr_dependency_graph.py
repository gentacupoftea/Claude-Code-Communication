#!/usr/bin/env python3
"""
PR Dependency Graph Generator for Conea Project

This script generates a dependency graph visualization from PR inventory data.
It shows relationships between PRs, highlighting dependencies and critical paths.

Usage:
    python pr_dependency_graph.py --input pr_inventory.json --output pr_dependencies.png

Requirements:
    - matplotlib
    - networkx
    - json
    - argparse
"""

import os
import sys
import json
import argparse
import networkx as nx
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors

def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Generate PR dependency graph")
    parser.add_argument("--input", required=True, help="Input JSON file with PR inventory data")
    parser.add_argument("--output", required=True, help="Output image file path (PNG)")
    parser.add_argument("--format", default="png", choices=["png", "pdf", "svg"], 
                        help="Output file format")
    return parser.parse_args()

def load_pr_data(input_file):
    """Load PR data from JSON file."""
    try:
        with open(input_file, 'r') as f:
            data = json.load(f)
        return data
    except Exception as e:
        print(f"Error loading PR data: {e}")
        sys.exit(1)

def create_graph(pr_data):
    """Create a networkx graph from PR data."""
    G = nx.DiGraph()
    
    # Add nodes (PRs)
    for pr in pr_data["pull_requests"]:
        # Node size based on complexity (higher = larger)
        size = 100 + (pr["complexity"] * 50)
        
        # Node color based on rename impact (higher = more red)
        rename_impact = pr["rename_impact"]["score"]
        if rename_impact > 7:
            color = "red"
        elif rename_impact > 4:
            color = "orange"
        else:
            color = "lightblue"
        
        # Border color based on review status
        if pr["reviews"]["status"] == "Approved":
            border_color = "green"
        elif pr["reviews"]["status"] == "Changes Requested":
            border_color = "red"
        elif pr["reviews"]["status"] == "Partially Approved":
            border_color = "yellow"
        else:
            border_color = "gray"
        
        G.add_node(
            pr["number"],
            label=f"#{pr['number']}",
            title=pr["title"],
            size=size,
            color=color,
            border_color=border_color,
            complexity=pr["complexity"],
            rename_impact=rename_impact,
            review_status=pr["reviews"]["status"]
        )
    
    # Add edges (dependencies)
    for pr in pr_data["pull_requests"]:
        for dep in pr["dependencies"]:
            try:
                dep_num = int(dep)
                # Check if the dependency exists in our graph
                if dep_num in G:
                    G.add_edge(pr["number"], dep_num)
            except ValueError:
                continue
    
    return G

def find_critical_path(G):
    """Identify critical path in the dependency graph."""
    # Find longest path in the graph
    try:
        # This assumes the graph is a DAG (Directed Acyclic Graph)
        longest_path = nx.dag_longest_path(G)
        return longest_path
    except nx.NetworkXError:
        # Graph has cycles
        print("Warning: Graph contains cycles, can't determine critical path")
        return []

def visualize_graph(G, output_file, output_format="png"):
    """Generate visualization of the PR dependency graph."""
    plt.figure(figsize=(12, 10))
    
    # Node positions using spring layout
    pos = nx.spring_layout(G, k=0.5, iterations=50)
    
    # Find critical path
    critical_path = find_critical_path(G)
    critical_edges = [(critical_path[i], critical_path[i+1]) 
                      for i in range(len(critical_path)-1)]
    
    # Extract node attributes
    node_sizes = [G.nodes[n]["size"] for n in G.nodes()]
    node_colors = [G.nodes[n]["color"] for n in G.nodes()]
    
    # Draw non-critical nodes and edges
    nx.draw_networkx_nodes(G, pos, node_size=node_sizes, node_color=node_colors, alpha=0.8)
    nx.draw_networkx_edges(G, pos, edgelist=[e for e in G.edges() if e not in critical_edges], 
                          arrows=True, width=1.0, alpha=0.5)
    
    # Draw critical path with different styling
    if critical_path:
        nx.draw_networkx_edges(G, pos, edgelist=critical_edges, arrows=True, 
                              width=3.0, edge_color="red")
    
    # Add labels
    labels = {n: f"#{n}" for n in G.nodes()}
    nx.draw_networkx_labels(G, pos, labels=labels, font_size=10)
    
    # Add legend
    legend_elements = [
        plt.Line2D([0], [0], marker='o', color='w', markerfacecolor="lightblue", markersize=10, label='Low Rename Impact'),
        plt.Line2D([0], [0], marker='o', color='w', markerfacecolor="orange", markersize=10, label='Medium Rename Impact'),
        plt.Line2D([0], [0], marker='o', color='w', markerfacecolor="red", markersize=10, label='High Rename Impact'),
        plt.Line2D([0], [0], color="red", lw=3, label='Critical Path')
    ]
    plt.legend(handles=legend_elements, loc="lower right")
    
    plt.title("Conea PR Dependency Graph")
    plt.axis("off")
    plt.tight_layout()
    
    # Save figure
    plt.savefig(output_file, format=output_format, dpi=300, bbox_inches="tight")
    print(f"Dependency graph saved to {output_file}")
    
    # Generate additional HTML report with PR details
    html_file = os.path.splitext(output_file)[0] + ".html"
    generate_html_report(G, critical_path, html_file, output_file)

def generate_html_report(G, critical_path, html_file, image_file):
    """Generate an HTML report with detailed PR information."""
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Conea PR Dependency Report</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .container { display: flex; flex-direction: column; max-width: 1200px; margin: 0 auto; }
            .graph { margin-bottom: 20px; text-align: center; }
            .graph img { max-width: 100%; }
            table { border-collapse: collapse; width: 100%; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
            tr:nth-child(even) { background-color: #f2f2f2; }
            th { background-color: #4CAF50; color: white; }
            .critical { background-color: #ffdddd; }
            .high-impact { color: red; font-weight: bold; }
            .medium-impact { color: orange; }
            .low-impact { color: green; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Conea PR Dependency Analysis</h1>
            
            <div class="graph">
                <h2>Dependency Graph</h2>
                <img src="{}" alt="PR Dependency Graph">
            </div>
            
            <h2>Pull Requests</h2>
            <table>
                <tr>
                    <th>PR #</th>
                    <th>Title</th>
                    <th>Complexity</th>
                    <th>Rename Impact</th>
                    <th>Review Status</th>
                    <th>Dependencies</th>
                    <th>Critical Path</th>
                </tr>
    """.format(os.path.basename(image_file))
    
    # Sort nodes by number
    sorted_nodes = sorted(G.nodes())
    
    for n in sorted_nodes:
        node = G.nodes[n]
        # Format rename impact class
        if node["rename_impact"] > 7:
            impact_class = "high-impact"
        elif node["rename_impact"] > 4:
            impact_class = "medium-impact"
        else:
            impact_class = "low-impact"
        
        # Check if in critical path
        is_critical = n in critical_path
        row_class = "critical" if is_critical else ""
        
        # Get dependencies
        dependencies = []
        for source, target in G.in_edges(n):
            dependencies.append(f"#{target}")
        dependencies_str = ", ".join(dependencies) if dependencies else "None"
        
        html += f"""
        <tr class="{row_class}">
            <td>#{n}</td>
            <td>{node["title"]}</td>
            <td>{node["complexity"]}/10</td>
            <td class="{impact_class}">{node["rename_impact"]}/10</td>
            <td>{node["review_status"]}</td>
            <td>{dependencies_str}</td>
            <td>{"Yes" if is_critical else "No"}</td>
        </tr>
        """
    
    html += """
            </table>
            
            <h2>Critical Path Analysis</h2>
            <p>The critical path represents the sequence of PRs that must be completed in order and 
               determines the minimum time needed to complete all dependent work.</p>
            
            <h3>Critical Path PRs:</h3>
            <ul>
    """
    
    for n in critical_path:
        html += f"<li>PR #{n}: {G.nodes[n]['title']}</li>"
    
    html += """
            </ul>
            
            <h2>Recommendations</h2>
            <ol>
                <li>Focus review efforts on PRs in the critical path</li>
                <li>PRs with high rename impact should be carefully reviewed for compatibility with Phase 2</li>
                <li>Consider breaking up complex PRs (complexity > 7) into smaller pieces</li>
                <li>Address PRs with requested changes promptly</li>
            </ol>
        </div>
    </body>
    </html>
    """
    
    with open(html_file, 'w') as f:
        f.write(html)
    
    print(f"HTML report saved to {html_file}")

def main():
    args = parse_args()
    
    # Load PR data
    data = load_pr_data(args.input)
    
    # Create dependency graph
    G = create_graph(data)
    
    # Visualize graph
    visualize_graph(G, args.output, args.format)

if __name__ == "__main__":
    main()