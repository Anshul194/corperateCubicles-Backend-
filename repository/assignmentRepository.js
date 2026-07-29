import Assignment from '../models/Assignment.js';

class AssignmentRepository {
    async create(data) {
        try {
            // NO CHANGE NEEDED: Data includes maxAttempts from service
            return await Assignment.create(data);
        } catch (error) {
            throw new Error(`Error creating assignment: ${error.message}`);
        }
    }

    async findAll({ page = 1, limit = 10, search = '', sortBy = 'createdAt', sortOrder = 'asc', filters = {} }) {
        try {
            const query = { ...filters };

            if (search) {
                query.title = { $regex: search, $options: 'i' };
            }

            const skip = (page - 1) * limit;

            const assignments = await Assignment.find(query)
                .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
                .skip(skip)
                .limit(limit)
                .populate('courseId', 'title')
                .populate('lessonId', 'title');

            const total = await Assignment.countDocuments(query);

            return {
                data: assignments,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            };
        } catch (error) {
            console.error('AssignmentRepository.findAll error:', error);
            throw error;
        }
    }

    async findById(id) {
        try {
            //console.log(`Finding assignment by id: ${id}`);
            return await Assignment.findById(id)
                .populate('courseId', 'title')
                .populate('lessonId', 'title');
        } catch (error) {
            throw new Error(`Error finding assignment by id: ${error.message}`);
        }
    }


    async update(id, data) {
        try {
            // NO CHANGE NEEDED: Data includes maxAttempts from service
            return await Assignment.findByIdAndUpdate(id, data, { new: true });
        } catch (error) {
            throw new Error(`Error updating assignment: ${error.message}`);
        }
    }

    async delete(id) {
        try {
            return await Assignment.findByIdAndDelete(id);
        } catch (error) {
            throw new Error(`Error deleting assignment: ${error.message}`);
        }
    }
}

export default new AssignmentRepository();