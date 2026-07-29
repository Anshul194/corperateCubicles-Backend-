import TextLessonRepository from '../repository/textLessonRepository.js';

class TextLessonService {
    static async createTextLesson(data) {
        try {
            return await TextLessonRepository.create(data);
        } catch (error) {
            throw new Error('Failed to create text lesson: ' + error.message);
        }
    }

   static async getAllTextLessons(options) {
    try {
        return await TextLessonRepository.findAll(options);
    } catch (error) {
        throw new Error('Failed to fetch text lessons: ' + error.message);
    }
}


    static async getTextLessonById(id) {
        try {
            return await TextLessonRepository.findById(id);
        } catch (error) {
            throw new Error('Failed to fetch text lesson: ' + error.message);
        }
    }

    static async updateTextLesson(id, data) {
        try {
            return await TextLessonRepository.updateById(id, data);
        } catch (error) {
            throw new Error('Failed to update text lesson: ' + error.message);
        }
    }

    static async deleteTextLesson(id) {
        try {
            return await TextLessonRepository.deleteById(id);
        } catch (error) {
            throw new Error('Failed to delete text lesson: ' + error.message);
        }
    }
}

export default TextLessonService;