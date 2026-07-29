import QueryService from '../service/QueryService.js';

const queryService = new QueryService();

export const createQuery = async (req, res) => {
  try {
    const query = await queryService.createQuery(req.body);
    res.status(201).json({ success: true, message: 'Query created', data: query });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAllQueries = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', status, category } = req.query;

    const queries = await queryService.getAllQueries({
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      status,
      category
    });

    res.status(200).json({ success: true, message: 'Queries fetched', ...queries });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


export const getQueryById = async (req, res) => {
  try {
    const query = await queryService.getQueryById(req.params.id);
    if (!query) return res.status(404).json({ success: false, message: 'Query not found' });
    res.status(200).json({ success: true, message: 'Query fetched', data: query });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateQuery = async (req, res) => {
  try {
    const updated = await queryService.updateQuery(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, message: 'Query not found' });
    res.status(200).json({ success: true, message: 'Query updated', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
