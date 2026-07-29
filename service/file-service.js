import fileRepo from '../repository/file-repo.js';

class FileService {
  async createFile(data) {
    try {
      return await fileRepo.create(data);
    } catch (error) {
      console.error('FileService.createFile error:', error);
      throw new Error(`Failed to create file: ${error.message}`);
    }
  }

  async getAllFiles(query) {
    //console.log('Fetching files with query:', query);
    try {
      return await fileRepo.findAll(query);
    } catch (error) {
      console.error('FileService.getAllFiles error:', error);
      throw new Error(`Failed to fetch files: ${error.message}`);
    }
  }

  async getFile(id) {
    try {
      //console.log("Fetching file with ID:", id);
      return await fileRepo.findById(id);
    } catch (error) {
      console.error('FileService.getFile error:', error);
      throw new Error(`Failed to get file: ${error.message}`);
    }
  }

  async updateFile(id, data) {
    try {
      //console.log('Updating file with ID:', id);
      return await fileRepo.update(id, data);
    } catch (error) {
      console.error('FileService.updateFile error:', error);
      throw new Error(`Failed to update file: ${error.message}`);
    }
  }

  async deleteFile(id) {
    try {
      return await fileRepo.delete(id);
    } catch (error) {
      console.error('FileService.deleteFile error:', error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }
}

export default new FileService();
