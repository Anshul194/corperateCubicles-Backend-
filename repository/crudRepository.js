class CrudRepository {
  constructor(model) {
    this.model = model;
  }

   async create(data) {
    try {
      //console.log("Certificate template data:", data);
      const result = await this.model.create(data);
      return result;
    } catch (error) {
      throw error;
    }
  }

  async destroy(id) {
    try {
      const result = await this.model.findByIdAndDelete(id);
      return result;
    } catch (error) {
      throw error;
    }
  }

  async get(id, populateFields = []) {
    try {
      let query = this.model.findById(id);

      // if (populateFields) {
      //   query = query.populate(populateFields);
      // }
      if (populateFields && populateFields.length > 0) {
        populateFields.forEach((field) => {
          query = query.populate(field);
        });
      }

      const result = await query.exec();
      return result;
    } catch (error) {
      throw error;
    }
  }

  async getAll(filterCon = {}, sortCon = {}, pageNum, limitNum, populateFields = [], selectFields = {}) {
    let query;
    sortCon = Object.keys(sortCon).length === 0 ? { createdAt: -1 } : sortCon;
    if (pageNum > 0) {
      query = this.model
        .find(filterCon)
        .select(selectFields)
        .sort(sortCon)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .collation({ locale: 'en', strength: 2 });
    } else {
      query = this.model
        .find(filterCon)
        .select(selectFields)
        .sort(sortCon)
        .collation({ locale: 'en', strength: 2 });
    }


    // Populate fields if any
    if (populateFields?.length > 0 && Object.keys(selectFields).length === 0) {
      populateFields?.forEach((field) => {
        query = query.populate(field);
      });
    }
    const result = await query;
    // Get the total count of documents matching the filter
    const totalDocuments = await this.model.countDocuments(filterCon);

    return {
      result,
      currentPage: pageNum,
      totalPages: Math.ceil(totalDocuments / limitNum),
      totalDocuments,
    };
  }

  async update(id, data) {
    try {
      const result = await this.model.findByIdAndUpdate(id, data, { new: true });
      return result;
    } catch (error) {
      throw error;
    }
  }
}

export default CrudRepository;
