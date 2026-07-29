import CertificateTemplate from '../models/CertificateTemplate.js';
import CrudRepository from './crudRepository.js';

class CertificateTemplateRepository extends CrudRepository {
  constructor() {
    super(CertificateTemplate);
  }

  async findById(id) {
    try {
      return await this.model.findById(id).lean();
    } catch (error) {
      throw new Error(`Error fetching certificate template: ${error.message}`);
    }
  }

  async findAll(page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;
      return await this.model.find().skip(skip).limit(limit).lean();
    } catch (error) {
      throw new Error(`Error fetching certificate templates: ${error.message}`);
    }
  }

  async countAll() {
    try {
      return await this.model.countDocuments();
    } catch (error) {
      throw new Error(`Error counting certificate templates: ${error.message}`);
    }
  }
}

export default CertificateTemplateRepository;