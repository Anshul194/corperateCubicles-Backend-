import QuickLinkRepository from '../repository/QuickLinkRepository.js';
import AppError from '../utils/app-error.js';
import { StatusCodes } from 'http-status-codes';

class QuickLinkService {
  constructor() {
    this.repository = new QuickLinkRepository();
  }

  async create(linkData) {
    try {
      const { title, url, description, icon, type, target } = linkData;
      if (!title || !url) {
        throw new Error('Title and URL are required');
      }

      const quickLink = await this.repository.create(linkData);
      return quickLink;
    } catch (error) {
      throw error;
    }
  }

  async getById(id) {
    try {
      const quickLink = await this.repository.get(id);
      if (!quickLink) {
        throw new Error('Quick link not found');
      }
      return quickLink;
    } catch (error) {
      throw error;
    }
  }

  async getAll(query) {
    try {
      const { page = 1, limit = 10, filters = "{}", search = "", sort = "{}" } = query;

      const pageNum = Math.max(parseInt(page) || 1, 1);
      const limitNum = Math.max(parseInt(limit) || 10, 1);
      const skip = (pageNum - 1) * limitNum;

      let parsedFilters = {};
      let parsedSort = {};

      try {
        parsedFilters = JSON.parse(filters);
        parsedSort = JSON.parse(sort);
      } catch (err) {
        console.warn('Invalid JSON for filters/sort');
      }

      const matchConditions = {
        ...parsedFilters,
      };

      if (search) {
        matchConditions.$or = [
          { title: { $regex: search, $options: 'i' } },
          { url: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ];
      }

      const pipeline = [
        { $match: matchConditions },
        {
          $lookup: {
            from: 'users',
            localField: 'createdBy',
            foreignField: '_id',
            as: 'createdByDetails',
          },
        },
        {
          $addFields: {
            createdByDetails: { $arrayElemAt: ['$createdByDetails', 0] },
          },
        },
      ];

      if (Object.keys(parsedSort).length > 0) {
        const sortStage = {};
        for (const [key, val] of Object.entries(parsedSort)) {
          sortStage[key] = val === 'asc' ? 1 : -1;
        }
        pipeline.push({ $sort: sortStage });
      } else {
        pipeline.push({ $sort: { createdAt: -1 } });
      }

      pipeline.push({
        $facet: {
          data: [{ $skip: skip }, { $limit: limitNum }],
          count: [{ $count: 'total' }],
        },
      });

      const [result] = await this.repository.aggregate(pipeline);

      const links = result.data;
      const total = result.count[0]?.total || 0;

      return {
        result: links,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      };
    } catch (error) {
      console.error('Error fetching quick links:', error.message);
      throw new AppError('Cannot fetch quick links', StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async updateById(id, updateData) {
    try {
      const quickLink = await this.repository.updateById(id, updateData);
      if (!quickLink) {
        throw new Error('Quick link not found');
      }
      return quickLink;
    } catch (error) {
      throw error;
    }
  }

  async softDeleteById(id) {
    try {
      const quickLink = await this.repository.destroy(id);
      if (!quickLink) {
        throw new Error('Quick link not found');
      }
      return quickLink;
    } catch (error) {
      throw error;
    }
  }
}

export default QuickLinkService;
