import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import Dexie, { Table } from 'dexie';

export interface FileData {
  id: string;
  name: string;
  type: 'file' | 'folder';
  size?: number;
  mimeType?: string;
  path: string;
  content?: ArrayBuffer | string;
  createdAt: Date;
  modifiedAt: Date;
}

class FileDatabase extends Dexie {
  files!: Table<FileData>;

  constructor() {
    super('ConeaFileDatabase');
    this.version(1).stores({
      files: 'id, name, path, type, mimeType',
    });
  }
}

const db = new FileDatabase();

export class FileService {
  static async uploadFile(file: File, parentPath: string): Promise<FileData> {
    const id = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const path = parentPath === '/' ? `/${file.name}` : `${parentPath}/${file.name}`;
    
    const content = await this.readFileContent(file);
    
    const fileData: FileData = {
      id,
      name: file.name,
      type: 'file',
      size: file.size,
      mimeType: file.type,
      path,
      content,
      createdAt: new Date(),
      modifiedAt: new Date(),
    };

    await db.files.add(fileData);
    return fileData;
  }

  static async createFolder(name: string, parentPath: string): Promise<FileData> {
    const id = `folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const path = parentPath === '/' ? `/${name}` : `${parentPath}/${name}`;
    
    const folderData: FileData = {
      id,
      name,
      type: 'folder',
      path,
      createdAt: new Date(),
      modifiedAt: new Date(),
    };

    await db.files.add(folderData);
    return folderData;
  }

  static async deleteFile(id: string): Promise<void> {
    const file = await db.files.get(id);
    if (file) {
      if (file.type === 'folder') {
        // フォルダの場合は、配下のファイルも削除
        const childFiles = await db.files
          .where('path')
          .startsWith(file.path + '/')
          .toArray();
        
        const childIds = childFiles.map((f) => f.id);
        await db.files.bulkDelete([id, ...childIds]);
      } else {
        await db.files.delete(id);
      }
    }
  }

  static async getFile(id: string): Promise<FileData | undefined> {
    return await db.files.get(id);
  }

  static async getFilesInPath(path: string): Promise<FileData[]> {
    const files = await db.files.toArray();
    
    // 指定されたパス直下のファイル・フォルダのみを取得
    return files.filter((file) => {
      const filePath = file.path;
      const parentPath = filePath.substring(0, filePath.lastIndexOf('/')) || '/';
      return parentPath === path;
    });
  }

  static async searchFiles(query: string): Promise<FileData[]> {
    const allFiles = await db.files.toArray();
    const lowerQuery = query.toLowerCase();
    
    return allFiles.filter(
      (file) =>
        file.name.toLowerCase().includes(lowerQuery) ||
        file.path.toLowerCase().includes(lowerQuery)
    );
  }

  private static async readFileContent(file: File): Promise<ArrayBuffer | string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result);
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      // テキストファイルの場合はテキストとして読み込む
      if (
        file.type.includes('text') ||
        file.name.endsWith('.csv') ||
        file.name.endsWith('.md') ||
        file.name.endsWith('.txt')
      ) {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    });
  }

  static async parseCSV(content: string): Promise<any> {
    return new Promise((resolve, reject) => {
      Papa.parse(content, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          resolve(results.data);
        },
        error: (error) => {
          reject(error);
        },
      });
    });
  }

  static async parseExcel(content: ArrayBuffer): Promise<any[]> {
    const workbook = XLSX.read(content, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    return XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  }

  static async exportToCSV(data: any[], filename: string): Promise<void> {
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  static async exportToExcel(data: any[], filename: string): Promise<void> {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    XLSX.writeFile(workbook, filename);
  }

  static getMimeTypeCategory(mimeType?: string): string {
    if (!mimeType) return 'unknown';
    
    if (mimeType.includes('csv') || mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
      return 'spreadsheet';
    }
    if (mimeType.includes('pdf')) {
      return 'pdf';
    }
    if (mimeType.includes('text') || mimeType.includes('markdown')) {
      return 'text';
    }
    if (mimeType.includes('image')) {
      return 'image';
    }
    
    return 'other';
  }

  static formatFileSize(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  }
}