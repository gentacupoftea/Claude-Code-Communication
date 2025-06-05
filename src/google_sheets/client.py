"""
Google Sheets APIクライアント
Googleスプレッドシートからデータを取得・更新する機能を提供
"""

import logging
import re
from typing import Dict, List, Any, Optional, Union, Tuple
from dataclasses import dataclass
import asyncio
from concurrent.futures import ThreadPoolExecutor

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google.oauth2.service_account import Credentials as ServiceAccountCredentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import httpx

logger = logging.getLogger(__name__)


@dataclass
class SheetRange:
    """スプレッドシートの範囲"""
    sheet_name: str
    start_row: int = 1
    start_col: str = 'A'
    end_row: Optional[int] = None
    end_col: Optional[str] = None
    
    def to_a1_notation(self) -> str:
        """A1記法の範囲文字列を生成"""
        if self.end_row and self.end_col:
            return f"{self.sheet_name}!{self.start_col}{self.start_row}:{self.end_col}{self.end_row}"
        elif self.end_col:
            return f"{self.sheet_name}!{self.start_col}{self.start_row}:{self.end_col}"
        elif self.end_row:
            return f"{self.sheet_name}!{self.start_col}{self.start_row}:{self.start_row + self.end_row - 1}"
        else:
            return f"{self.sheet_name}!{self.start_col}{self.start_row}:{self.start_col}"


@dataclass
class SheetMetadata:
    """スプレッドシートのメタデータ"""
    spreadsheet_id: str
    title: str
    sheets: List[Dict[str, Any]]
    permissions: List[str]
    created_time: Optional[str] = None
    modified_time: Optional[str] = None
    owner: Optional[str] = None


@dataclass
class SheetData:
    """スプレッドシートのデータ"""
    values: List[List[Any]]
    range: str
    major_dimension: str = 'ROWS'
    headers: Optional[List[str]] = None
    row_count: int = 0
    col_count: int = 0
    
    def __post_init__(self):
        if self.values:
            self.row_count = len(self.values)
            self.col_count = max(len(row) for row in self.values) if self.values else 0
            
            # ヘッダーが指定されていない場合、最初の行をヘッダーとして使用
            if self.headers is None and self.values:
                self.headers = [str(cell) for cell in self.values[0]]


class GoogleSheetsError(Exception):
    """Google Sheets API関連のエラー"""
    
    def __init__(self, message: str, error_code: Optional[str] = None, details: Optional[Dict] = None):
        super().__init__(message)
        self.error_code = error_code
        self.details = details or {}


class GoogleSheetsClient:
    """
    Google Sheets APIクライアント
    認証、データ取得、更新機能を提供
    """
    
    # APIスコープ
    SCOPES = [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.readonly'
    ]
    
    def __init__(self, 
                 credentials: Union[Credentials, ServiceAccountCredentials, Dict[str, Any]],
                 max_retries: int = 3,
                 timeout: int = 30):
        """
        Google Sheetsクライアントを初期化
        
        Args:
            credentials: 認証情報
            max_retries: リトライ回数
            timeout: タイムアウト（秒）
        """
        self.max_retries = max_retries
        self.timeout = timeout
        self.executor = ThreadPoolExecutor(max_workers=4)
        
        # 認証情報の設定
        self.credentials = self._setup_credentials(credentials)
        
        # Google Sheets APIサービスを初期化
        self.service = None
        self.drive_service = None
        
    def _setup_credentials(self, credentials: Union[Credentials, ServiceAccountCredentials, Dict[str, Any]]) -> Union[Credentials, ServiceAccountCredentials]:
        """
        認証情報を設定
        
        Args:
            credentials: 認証情報
            
        Returns:
            設定済みの認証情報
        """
        if isinstance(credentials, (Credentials, ServiceAccountCredentials)):
            return credentials
        elif isinstance(credentials, dict):
            # サービスアカウント認証情報から作成
            return ServiceAccountCredentials.from_service_account_info(
                credentials, scopes=self.SCOPES
            )
        else:
            raise GoogleSheetsError("Invalid credentials format")
    
    async def initialize(self):
        """
        APIサービスを初期化（非同期）
        """
        def _build_services():
            # Google Sheets APIサービス
            self.service = build('sheets', 'v4', credentials=self.credentials)
            # Google Drive APIサービス（メタデータ取得用）
            self.drive_service = build('drive', 'v3', credentials=self.credentials)
        
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(self.executor, _build_services)
        
        logger.info("Google Sheets client initialized successfully")
    
    async def get_spreadsheet_metadata(self, spreadsheet_id: str) -> SheetMetadata:
        """
        スプレッドシートのメタデータを取得
        
        Args:
            spreadsheet_id: スプレッドシートID
            
        Returns:
            SheetMetadata: メタデータ
        """
        if not self.service:
            await self.initialize()
        
        try:
            def _get_metadata():
                # スプレッドシート情報を取得
                spreadsheet = self.service.spreadsheets().get(
                    spreadsheetId=spreadsheet_id
                ).execute()
                
                # Drive APIから追加情報を取得
                file_info = self.drive_service.files().get(
                    fileId=spreadsheet_id,
                    fields='createdTime,modifiedTime,owners,permissions'
                ).execute()
                
                return spreadsheet, file_info
            
            loop = asyncio.get_event_loop()
            spreadsheet, file_info = await loop.run_in_executor(
                self.executor, _get_metadata
            )
            
            # メタデータを構築
            sheets = []
            for sheet in spreadsheet.get('sheets', []):
                sheet_props = sheet.get('properties', {})
                sheets.append({
                    'sheet_id': sheet_props.get('sheetId'),
                    'title': sheet_props.get('title'),
                    'index': sheet_props.get('index'),
                    'sheet_type': sheet_props.get('sheetType', 'GRID'),
                    'grid_properties': sheet_props.get('gridProperties', {})
                })
            
            return SheetMetadata(
                spreadsheet_id=spreadsheet_id,
                title=spreadsheet.get('properties', {}).get('title', ''),
                sheets=sheets,
                permissions=[],  # 権限情報は複雑なため簡略化
                created_time=file_info.get('createdTime'),
                modified_time=file_info.get('modifiedTime'),
                owner=file_info.get('owners', [{}])[0].get('emailAddress') if file_info.get('owners') else None
            )
            
        except HttpError as e:
            logger.error(f"Failed to get spreadsheet metadata: {e}")
            raise GoogleSheetsError(
                f"Failed to get metadata for spreadsheet {spreadsheet_id}",
                error_code=str(e.resp.status),
                details={'error': str(e)}
            )
        except Exception as e:
            logger.exception(f"Unexpected error getting spreadsheet metadata: {e}")
            raise GoogleSheetsError(f"Unexpected error: {str(e)}")
    
    async def get_sheet_data(self, 
                           spreadsheet_id: str,
                           range_spec: Union[str, SheetRange],
                           value_render_option: str = 'FORMATTED_VALUE',
                           date_time_render_option: str = 'FORMATTED_STRING') -> SheetData:
        """
        スプレッドシートからデータを取得
        
        Args:
            spreadsheet_id: スプレッドシートID
            range_spec: 範囲指定（A1記法またはSheetRangeオブジェクト）
            value_render_option: 値の表示形式
            date_time_render_option: 日時の表示形式
            
        Returns:
            SheetData: 取得したデータ
        """
        if not self.service:
            await self.initialize()
        
        # 範囲を文字列に変換
        if isinstance(range_spec, SheetRange):
            range_str = range_spec.to_a1_notation()
        else:
            range_str = range_spec
        
        try:
            def _get_values():
                return self.service.spreadsheets().values().get(
                    spreadsheetId=spreadsheet_id,
                    range=range_str,
                    valueRenderOption=value_render_option,
                    dateTimeRenderOption=date_time_render_option
                ).execute()
            
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(self.executor, _get_values)
            
            values = result.get('values', [])
            major_dimension = result.get('majorDimension', 'ROWS')
            actual_range = result.get('range', range_str)
            
            return SheetData(
                values=values,
                range=actual_range,
                major_dimension=major_dimension
            )
            
        except HttpError as e:
            logger.error(f"Failed to get sheet data: {e}")
            raise GoogleSheetsError(
                f"Failed to get data from range {range_str}",
                error_code=str(e.resp.status),
                details={'error': str(e)}
            )
        except Exception as e:
            logger.exception(f"Unexpected error getting sheet data: {e}")
            raise GoogleSheetsError(f"Unexpected error: {str(e)}")
    
    async def get_multiple_ranges(self,
                                spreadsheet_id: str,
                                ranges: List[Union[str, SheetRange]]) -> List[SheetData]:
        """
        複数の範囲からデータを一度に取得
        
        Args:
            spreadsheet_id: スプレッドシートID
            ranges: 範囲のリスト
            
        Returns:
            List[SheetData]: 取得したデータのリスト
        """
        if not self.service:
            await self.initialize()
        
        # 範囲を文字列に変換
        range_strings = []
        for range_spec in ranges:
            if isinstance(range_spec, SheetRange):
                range_strings.append(range_spec.to_a1_notation())
            else:
                range_strings.append(range_spec)
        
        try:
            def _batch_get():
                return self.service.spreadsheets().values().batchGet(
                    spreadsheetId=spreadsheet_id,
                    ranges=range_strings
                ).execute()
            
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(self.executor, _batch_get)
            
            sheet_data_list = []
            for value_range in result.get('valueRanges', []):
                values = value_range.get('values', [])
                major_dimension = value_range.get('majorDimension', 'ROWS')
                actual_range = value_range.get('range', '')
                
                sheet_data_list.append(SheetData(
                    values=values,
                    range=actual_range,
                    major_dimension=major_dimension
                ))
            
            return sheet_data_list
            
        except HttpError as e:
            logger.error(f"Failed to get multiple ranges: {e}")
            raise GoogleSheetsError(
                f"Failed to get data from multiple ranges",
                error_code=str(e.resp.status),
                details={'error': str(e)}
            )
        except Exception as e:
            logger.exception(f"Unexpected error getting multiple ranges: {e}")
            raise GoogleSheetsError(f"Unexpected error: {str(e)}")
    
    async def update_sheet_data(self,
                              spreadsheet_id: str,
                              range_spec: Union[str, SheetRange],
                              values: List[List[Any]],
                              value_input_option: str = 'RAW') -> Dict[str, Any]:
        """
        スプレッドシートのデータを更新
        
        Args:
            spreadsheet_id: スプレッドシートID
            range_spec: 範囲指定
            values: 更新する値
            value_input_option: 値の入力形式
            
        Returns:
            更新結果
        """
        if not self.service:
            await self.initialize()
        
        # 範囲を文字列に変換
        if isinstance(range_spec, SheetRange):
            range_str = range_spec.to_a1_notation()
        else:
            range_str = range_spec
        
        try:
            def _update_values():
                body = {
                    'values': values
                }
                return self.service.spreadsheets().values().update(
                    spreadsheetId=spreadsheet_id,
                    range=range_str,
                    valueInputOption=value_input_option,
                    body=body
                ).execute()
            
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(self.executor, _update_values)
            
            logger.info(f"Updated {result.get('updatedCells', 0)} cells in range {range_str}")
            return result
            
        except HttpError as e:
            logger.error(f"Failed to update sheet data: {e}")
            raise GoogleSheetsError(
                f"Failed to update range {range_str}",
                error_code=str(e.resp.status),
                details={'error': str(e)}
            )
        except Exception as e:
            logger.exception(f"Unexpected error updating sheet data: {e}")
            raise GoogleSheetsError(f"Unexpected error: {str(e)}")
    
    def extract_spreadsheet_id(self, url: str) -> str:
        """
        スプレッドシートURLからIDを抽出
        
        Args:
            url: スプレッドシートURL
            
        Returns:
            str: スプレッドシートID
        """
        # Google SheetsのURL形式パターン
        patterns = [
            r'/spreadsheets/d/([a-zA-Z0-9-_]+)',
            r'spreadsheets/d/([a-zA-Z0-9-_]+)',
            r'docs\.google\.com/spreadsheets/d/([a-zA-Z0-9-_]+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        
        # URLではなく直接IDが渡された場合
        if re.match(r'^[a-zA-Z0-9-_]+$', url):
            return url
        
        raise GoogleSheetsError(f"Could not extract spreadsheet ID from: {url}")
    
    def parse_range_string(self, range_str: str) -> SheetRange:
        """
        A1記法の範囲文字列をSheetRangeオブジェクトに変換
        
        Args:
            range_str: A1記法の範囲文字列（例: "Sheet1!A1:C10"）
            
        Returns:
            SheetRange: 範囲オブジェクト
        """
        # シート名と範囲を分離
        if '!' in range_str:
            sheet_name, range_part = range_str.split('!', 1)
        else:
            sheet_name = 'Sheet1'  # デフォルト
            range_part = range_str
        
        # 範囲を解析
        if ':' in range_part:
            start_cell, end_cell = range_part.split(':', 1)
        else:
            start_cell = range_part
            end_cell = None
        
        # セル参照を解析（例: A1 -> col='A', row=1）
        start_match = re.match(r'([A-Z]+)(\d+)', start_cell)
        if not start_match:
            raise GoogleSheetsError(f"Invalid cell reference: {start_cell}")
        
        start_col, start_row = start_match.groups()
        start_row = int(start_row)
        
        end_col = None
        end_row = None
        
        if end_cell:
            end_match = re.match(r'([A-Z]+)(\d+)', end_cell)
            if end_match:
                end_col, end_row = end_match.groups()
                end_row = int(end_row)
        
        return SheetRange(
            sheet_name=sheet_name,
            start_row=start_row,
            start_col=start_col,
            end_row=end_row,
            end_col=end_col
        )
    
    async def close(self):
        """
        クライアントを終了
        """
        if self.executor:
            self.executor.shutdown(wait=True)
        
        logger.info("Google Sheets client closed")