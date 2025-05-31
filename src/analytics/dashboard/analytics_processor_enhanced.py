"""Enhanced Analytics data processor with PDF export support."""

import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from io import BytesIO
import matplotlib.pyplot as plt
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors

from ...api.shopify_api import ShopifyAPI
from ...data_integration.validation.data_validator import DataValidator


class AnalyticsProcessor:
    """Enhanced analytics processor with PDF export support."""
    
    def __init__(self, shopify_api: ShopifyAPI):
        self.api = shopify_api
        self.validator = DataValidator()
    
    def export_data(self, data: Any, format: str = 'csv') -> bytes:
        """Export data in specified format including PDF.
        
        Args:
            data: Data to export
            format: Export format ('csv', 'json', 'excel', 'pdf')
            
        Returns:
            Exported data as bytes
        """
        if isinstance(data, list):
            df = pd.DataFrame(data)
        elif isinstance(data, dict):
            # Try to extract data from common response format
            if 'data' in data:
                df = pd.DataFrame(data['data'])
                metadata = {k: v for k, v in data.items() if k != 'data'}
            else:
                df = pd.DataFrame([data])
                metadata = {}
        else:
            df = pd.DataFrame(data)
            metadata = {}
        
        if format == 'csv':
            return df.to_csv(index=False).encode('utf-8')
        elif format == 'json':
            return df.to_json(orient='records').encode('utf-8')
        elif format == 'excel':
            buffer = BytesIO()
            df.to_excel(buffer, index=False, engine='openpyxl')
            return buffer.getvalue()
        elif format == 'pdf':
            return self._export_to_pdf(df, metadata)
        else:
            raise ValueError(f"Unsupported export format: {format}")
    
    def _export_to_pdf(self, df: pd.DataFrame, metadata: Dict[str, Any] = None) -> bytes:
        """Export DataFrame to PDF format.
        
        Args:
            df: DataFrame to export
            metadata: Additional metadata for the PDF
            
        Returns:
            PDF content as bytes
        """
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=18,
        )
        
        story = []
        styles = getSampleStyleSheet()
        
        # Title
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#333333'),
            spaceAfter=30,
            alignment=1  # Center alignment
        )
        
        export_date = datetime.now().strftime('%Y年%m月%d日 %H:%M')
        title = Paragraph(f"データエクスポートレポート<br/>{export_date}", title_style)
        story.append(title)
        story.append(Spacer(1, 12))
        
        # Metadata section
        if metadata:
            meta_style = ParagraphStyle(
                'Metadata',
                parent=styles['Normal'],
                fontSize=10,
                textColor=colors.HexColor('#666666'),
                spaceAfter=12
            )
            
            for key, value in metadata.items():
                if key not in ['data']:  # Skip data field
                    meta_text = f"<b>{key}:</b> {value}"
                    story.append(Paragraph(meta_text, meta_style))
            
            story.append(Spacer(1, 12))
        
        # Summary statistics
        if not df.empty:
            summary_data = []
            summary_data.append(['統計情報', '値'])
            summary_data.append(['レコード数', str(len(df))])
            summary_data.append(['カラム数', str(len(df.columns))])
            
            # Add numeric column statistics
            numeric_columns = df.select_dtypes(include=[np.number]).columns
            for col in numeric_columns[:5]:  # Limit to first 5 numeric columns
                summary_data.append([f'{col} (平均)', f'{df[col].mean():.2f}'])
                summary_data.append([f'{col} (合計)', f'{df[col].sum():.2f}'])
            
            summary_table = Table(summary_data, colWidths=[3*inch, 2*inch])
            summary_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 14),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            story.append(summary_table)
            story.append(Spacer(1, 12))
        
        # Data visualization (if applicable)
        if not df.empty and len(numeric_columns) > 0:
            try:
                # Create a simple chart
                fig, ax = plt.subplots(figsize=(8, 4))
                
                # If there's a date column, create a time series plot
                date_columns = df.select_dtypes(include=['datetime64']).columns
                if len(date_columns) > 0 and len(numeric_columns) > 0:
                    df[date_columns[0]].hist(ax=ax, bins=20)
                    ax.set_title('データ分布')
                    ax.set_xlabel('日付')
                    ax.set_ylabel('頻度')
                else:
                    # Create a bar chart of the first numeric column
                    col = numeric_columns[0]
                    df[col].head(20).plot(kind='bar', ax=ax)
                    ax.set_title(f'{col} の分布')
                    ax.set_xlabel('インデックス')
                    ax.set_ylabel(col)
                
                # Save chart to buffer
                chart_buffer = BytesIO()
                plt.tight_layout()
                plt.savefig(chart_buffer, format='png', dpi=100)
                plt.close()
                
                # Add chart to PDF
                chart_buffer.seek(0)
                img = Image(chart_buffer, width=6*inch, height=3*inch)
                story.append(img)
                story.append(Spacer(1, 12))
            except Exception as e:
                # If chart creation fails, continue without it
                pass
        
        # Main data table (paginated for large datasets)
        if not df.empty:
            # Convert DataFrame to list format for table
            data_for_table = [df.columns.tolist()]  # Headers
            
            # Limit rows for PDF (too many rows make PDF huge)
            max_rows = 100
            if len(df) > max_rows:
                data_for_table.extend(df.head(max_rows).values.tolist())
                
                # Add note about truncation
                note_style = ParagraphStyle(
                    'Note',
                    parent=styles['Normal'],
                    fontSize=10,
                    textColor=colors.red,
                    spaceAfter=12
                )
                note_text = f"注意: データが多いため、最初の{max_rows}行のみ表示しています。(全{len(df)}行)"
                story.append(Paragraph(note_text, note_style))
            else:
                data_for_table.extend(df.values.tolist())
            
            # Create table with appropriate column widths
            col_widths = [min(2*inch, max(1*inch, len(str(col))*0.1*inch)) for col in df.columns]
            if sum(col_widths) > 7*inch:  # Scale down if too wide
                scale = 7*inch / sum(col_widths)
                col_widths = [w * scale for w in col_widths]
            
            data_table = Table(data_for_table, colWidths=col_widths)
            data_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 12),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('FONTSIZE', (0, 1), (-1, -1), 8),
            ]))
            story.append(data_table)
        
        # Build PDF
        doc.build(story)
        buffer.seek(0)
        return buffer.getvalue()
    
    # Include all other methods from the original AnalyticsProcessor class
    # (get_order_summary, get_category_sales, etc.)
    # ... (copy other methods from original class)