import { access, stat, mkdir } from 'fs/promises';
import { constants } from 'fs';
import { resolve } from 'path';

export async function ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
        await access(dirPath, constants.F_OK);
    } catch {
        await mkdir(dirPath, { recursive: true });
    }
}

export async function validateProjectPath(projectPath: string): Promise<string> {
    try {
        // Resolve to absolute path
        const absolutePath = resolve(projectPath);

        // Check if path exists
        await access(absolutePath, constants.F_OK);

        // Ensure it's a directory
        const stats = await stat(absolutePath);
        if (!stats.isDirectory()) {
            throw new Error(`Project path is not a directory: ${absolutePath}`);
        }

        return absolutePath;
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            throw new Error(`Project path does not exist: ${projectPath}`);
        }
        throw error;
    }
}