// services/course-bundle-service.js
import bundleRepo from '../repository/course-bundle-repository.js';

class CourseBundleService {
async create(data, files) {
    // Handle individual file fields
    //console.log('Received data:', data);
    //console.log('Received files:', files);
    if (Array.isArray(files)) {
        files.forEach(file => {
            if (file.fieldname === 'thumbnail') data.thumbnail = file.path;
            if (file.fieldname === 'banner') data.banner = file.path;
            if (file.fieldname === 'video') data.video = file.path;
            if (file.fieldname === 'attachmentFile') data.attachmentFile = file.path;
            if (file.fieldname === 'documentFile') data.documentFile = file.path;
        });
    }
    return await bundleRepo.create(data);
}

 async getAll(query) {
  try {
    return await bundleRepo.findAll(query);
  } catch (error) {
    console.error('BundleService: Error in getAll:', error);
    throw error;
  }
}


  async getById(id) {
    return await bundleRepo.findById(id);
  }

async update(id, data, files) {
    // Handle individual file fields for update
    if (Array.isArray(files)) {
        files.forEach(file => {
            if (file.fieldname === 'thumbnail') data.thumbnail = file.path;
            if (file.fieldname === 'banner') data.banner = file.path;
            if (file.fieldname === 'video') data.video = file.path;
            if (file.fieldname === 'attachmentFile') data.attachmentFile = file.path;
            if (file.fieldname === 'documentFile') data.documentFile = file.path;
        });
    }
    return await bundleRepo.update(id, data);
}

  async delete(id) {
    return await bundleRepo.delete(id);
  }
}

export default new CourseBundleService();
