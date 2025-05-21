#!/usr/bin/env python
"""
Tests for PR triage CI integration scripts.

This module contains tests for the scripts used in the PR triage CI workflow,
including generate_pr_comment.py.
"""

import json
import os
import sys
import unittest
from unittest.mock import patch, MagicMock

# Add scripts directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from generate_pr_comment import calculate_category, generate_comment


class TestPRTriage(unittest.TestCase):
    """Test PR triage CI integration scripts."""

    def setUp(self):
        """Set up test fixtures."""
        self.pr_data = {
            "number": 123,
            "title": "Test PR",
            "author": "test-user",
            "age": 5,
            "review_count": 2,
            "has_failing_ci": False
        }
        
        self.rename_impact = {
            "pull_requests": [
                {
                    "number": 123,
                    "rename_impact": {
                        "score": 6,
                        "affected_files": ["file1.py", "file2.py"]
                    }
                }
            ]
        }
        
        self.conflicts = {
            "conflicts": [
                {
                    "pr1": 123,
                    "pr2": 456,
                    "reason": "File overlap in file1.py"
                }
            ]
        }
        
        self.dependencies = {
            "dependencies": [
                {
                    "source": 123,
                    "target": 456,
                    "type": "depends_on"
                }
            ]
        }

    def test_calculate_category(self):
        """Test the calculate_category function."""
        category, reasons = calculate_category(
            self.pr_data,
            json.dumps(self.rename_impact),
            json.dumps(self.conflicts),
            json.dumps(self.dependencies)
        )
        
        # Should be category B due to moderate rename impact score and conflicts
        self.assertEqual(category, "B")
        self.assertTrue(any("rename impact" in reason.lower() for reason in reasons))
        self.assertTrue(any("conflict" in reason.lower() for reason in reasons))
    
    def test_calculate_category_high_impact(self):
        """Test category calculation with high impact score."""
        # Modify impact score to 9
        self.rename_impact["pull_requests"][0]["rename_impact"]["score"] = 9
        
        category, reasons = calculate_category(
            self.pr_data,
            json.dumps(self.rename_impact),
            json.dumps(self.conflicts),
            json.dumps(self.dependencies)
        )
        
        # Should be category A due to high rename impact
        self.assertEqual(category, "A")
        self.assertTrue(any("high rename impact" in reason.lower() for reason in reasons))
    
    def test_calculate_category_no_reviews(self):
        """Test category calculation with no reviews."""
        # Modify PR data to have no reviews
        self.pr_data["review_count"] = 0
        
        category, reasons = calculate_category(
            self.pr_data,
            json.dumps(self.rename_impact),
            json.dumps(self.conflicts),
            json.dumps(self.dependencies)
        )
        
        # Should still be category B due to conflicts/impact, but include review reason
        self.assertEqual(category, "B")
        self.assertTrue(any("no reviews" in reason.lower() for reason in reasons))
    
    def test_calculate_category_old_pr(self):
        """Test category calculation with an old PR."""
        # Modify PR data to be old
        self.pr_data["age"] = 20
        
        # Modify impact score to be low
        self.rename_impact["pull_requests"][0]["rename_impact"]["score"] = 2
        
        # Remove conflicts
        self.conflicts = {"conflicts": []}
        
        category, reasons = calculate_category(
            self.pr_data,
            json.dumps(self.rename_impact),
            json.dumps(self.conflicts),
            json.dumps(self.dependencies)
        )
        
        # Should be category D due to being old with low impact
        self.assertEqual(category, "D")
        self.assertTrue(any(f"{self.pr_data['age']} days old" in reason for reason in reasons))
    
    def test_generate_comment(self):
        """Test comment generation."""
        comment = generate_comment(
            json.dumps(self.pr_data),
            json.dumps(self.rename_impact),
            json.dumps(self.conflicts),
            json.dumps(self.dependencies)
        )
        
        # Check that comment contains expected sections
        self.assertIn("## PR Triage Report", comment)
        self.assertIn("### PR Information", comment)
        self.assertIn("### Phase 2 Rename Impact", comment)
        self.assertIn("### Conflicts and Dependencies", comment)
        self.assertIn("### Triage Recommendation", comment)
        
        # Check that PR info is included
        self.assertIn(self.pr_data["title"], comment)
        self.assertIn(self.pr_data["author"], comment)
        self.assertIn(str(self.pr_data["age"]), comment)
        
        # Check that rename impact info is included
        self.assertIn("Impact Score", comment)
        self.assertIn(str(self.rename_impact["pull_requests"][0]["rename_impact"]["score"]), comment)
        
        # Check that conflict info is included
        self.assertIn("Potential Conflicts", comment)
        self.assertIn("PR #456", comment)
        
        # Check that dependency info is included
        self.assertIn("Dependencies", comment)
        self.assertIn("This PR depends on PR #456", comment)
        
        # Check that category info is included
        self.assertIn("Recommended Category", comment)
        self.assertIn("Category B", comment)
        
        # Check that category definitions are included
        self.assertIn("Category A", comment)
        self.assertIn("Category B", comment)
        self.assertIn("Category C", comment)
        self.assertIn("Category D", comment)


if __name__ == "__main__":
    unittest.main()