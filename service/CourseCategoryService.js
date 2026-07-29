import CourseCategoryRepository from '../repository/CourseCategoryRepository.js';
import slugify from 'slugify';
import AppError from '../utils/app-error.js';
import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import path from 'path';
const { ObjectId } = Types;
class CourseCategoryService {
  constructor() {
    this.repository = new CourseCategoryRepository();
  }

  async create(categoryData) {
    try {
      //console.log('📥 Creating category with data:', categoryData);
      const { name, status, image } = categoryData;
      if (!name || !status) {
        throw new Error('Name and status are required');
      }

      const slug = slugify(name, { lower: true, strict: true });
      const existingCategory = await this.repository.findBy({ slug });
      if (existingCategory) {
        throw new Error('Category slug already exists');
      }

      const category = await this.repository.create({ name, slug, status, image });
      return category;
    } catch (error) {
      throw error;
    }
  }

  async getById(id) {
    try {
      const pipeline = [
        { $match: { _id: new ObjectId(id), deletedAt: null } },
        {
          $lookup: {
            from: "subcategories",
            let: { categoryId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$categoryId", "$$categoryId"] },
                    
                      { $ne: ["$isDeleted", true] }
                    ]
                  }
                }
              }
            ],
            as: "subcategories"
          }
        },
        {
          $addFields: {
            subCategoryCount: { $size: "$subcategories" }
          }
        }
      ];

      const [category] = await this.repository.aggregate(pipeline);

      if (!category) {
        throw new Error('Category not found');
      }

      return category;
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
      console.warn("⚠️ Invalid JSON for filters/sort");
    }

    const matchConditions = {
      deletedAt: null,
      isDeleted: false, 
    };

   
    for (const [key, value] of Object.entries(parsedFilters)) {
      matchConditions[key] = value;
    }

   
    if (search) {
      matchConditions.$or = [
        { name: { $regex: search, $options: "i" } },
        { slug: { $regex: search, $options: "i" } }
      ];
    }

    const pipeline = [
      { $match: matchConditions },
      {
        $lookup: {
          from: "subcategories", 
          let: { categoryId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$categoryId", "$$categoryId"] },
                    { $eq: ["$isDeleted", false] },
                    { $eq: ["$deletedAt", null] }
                  ]
                }
              }
            }
          ],
          as: "subcategories"
        }
      },
            {
        $addFields: {
          subCategoryCount: { $size: "$subcategories" }
        }
      },
      {
        $project: {
          subcategories: 0 
        }
      }
    ];

   
    if (Object.keys(parsedSort).length > 0) {
      const sortStage = {};
      for (const [key, val] of Object.entries(parsedSort)) {
        sortStage[key] = val === "asc" ? 1 : -1;
      }
      pipeline.push({ $sort: sortStage });
    } else {
      pipeline.push({ $sort: { createdAt: -1 } }); 
    }

    
    pipeline.push({
      $facet: {
        data: [
          { $skip: skip },
          { $limit: limitNum }
        ],
        count: [
          { $count: "total" }
        ]
      }
    });

    const [result] = await this.repository.aggregate(pipeline);

    const categories = result.data;
    const total = result.count[0]?.total || 0;

    return {
      result: categories,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    };
  } catch (error) {
    console.error("❌ Error fetching categories:", error.message);
    throw new AppError("Cannot fetch data of all categories", StatusCodes.INTERNAL_SERVER_ERROR);
  }
}


  async updateById(id, updateData) {
    try {
      const { name, status, image } = updateData;
      const updateFields = {};
      let oldImagePath;

      // If updating name, generate new slug and check for conflicts
      if (name) {
        updateFields.name = name;
        updateFields.slug = slugify(name, { lower: true, strict: true });
        const existingCategory = await this.repository.findBy({ slug: updateFields.slug });
        if (existingCategory && existingCategory._id.toString() !== id) {
          throw new Error('Category slug already exists');
        }
      }

      if (status) {
        updateFields.status = status;
      }
      if (image) {
        updateFields.image = image;
      }
      if (Object.keys(updateFields).length === 0) {
        throw new Error('No valid fields to update');
      }

      const updatedCategory = await this.repository.updateById(id, updateFields);
      if (!updatedCategory) {
        throw new Error('Category not found');
      }

      // Delete old image file if it exists
      if (oldImagePath) {
        try {
          await fs.unlink(oldImagePath);
          //console.log(`🗑️ Old category image deleted: ${oldImagePath}`);
        } catch (err) {
          console.warn(`⚠️ Failed to delete old image: ${oldImagePath}`, err.message);
        }
      }

      return updatedCategory;
    } catch (error) {
      throw error;
    }
  }

  async softDeleteById(id) {
    try {
      const deletedCategory = await this.repository.softDeleteById(id);
      if (!deletedCategory) {
        throw new Error('Category not found');
      }

      // Optionally, delete the image file when soft-deleting
      if (deletedCategory.image) {
        const imagePath = path.join('uploads', deletedCategory.image);
        try {
          await fs.unlink(imagePath);
          //console.log(`🗑️ Category image deleted on soft delete: ${imagePath}`);
        } catch (err) {
          console.warn(`⚠️ Failed to delete image on soft delete: ${imagePath}`, err.message);
        }
      }

      return deletedCategory;
    } catch (error) {
      throw error;
    }
  }
}

export default CourseCategoryService;