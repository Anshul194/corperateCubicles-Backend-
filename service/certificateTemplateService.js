import CertificateTemplateRepository from '../repository/certificateTemplateRepository.js';

class CertificateTemplateService {
  constructor() {
    this.certificateTemplateRepository = new CertificateTemplateRepository();
  }

 async createCertificateTemplate(data, userId) {
    try {
      const templateData = {
        ...data,
        created_by: userId,
      };
      return await this.certificateTemplateRepository.create(templateData);
    } catch (error) {
      throw new Error(`Error creating certificate template: ${error.message}`);
    }
  }

  async getCertificateTemplate(id) {
    try {
      const template = await this.certificateTemplateRepository.findById(id);
      if (!template) {
        throw new Error('Certificate template not found');
      }
      return template;
    } catch (error) {
      throw new Error(`Error fetching certificate template: ${error.message}`);
    }
  }

  async getAllCertificateTemplates(page = 1, limit = 10) {
    try {
      const [templates, totalCount] = await Promise.all([
        this.certificateTemplateRepository.findAll(page, limit),
        this.certificateTemplateRepository.countAll(),
      ]);
      return { templates, totalCount };
    } catch (error) {
      throw new Error(`Error fetching certificate templates: ${error.message}`);
    }
  }

  async updateCertificateTemplate(id, data, userId) {
    try {
      const template = await this.certificateTemplateRepository.findById(id);
      if (!template) {
        throw new Error('Certificate template not found');
      }
      const updateData = {
        ...data,
        updated_by: userId,
      };
      return await this.certificateTemplateRepository.update(id, updateData);
    } catch (error) {
      throw new Error(`Error updating certificate template: ${error.message}`);
    }
  }

  async deleteCertificateTemplate(id) {
    try { 
      const template = await this.certificateTemplateRepository.findById(id);
      if (!template) {
        throw new Error('Certificate template not found');
      }
      return await this.certificateTemplateRepository.destroy(id);
    } catch (error) {
      throw new Error(`Error deleting certificate template: ${error.message}`);
    }
  }
}

export default CertificateTemplateService;