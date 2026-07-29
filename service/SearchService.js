import Course from '../models/Course.js';
import CourseBundle from '../models/CourseBundle.js';
import CoursePlan from '../models/CoursePlan.js'; // <-- Add this import
import { escapeRegex } from '../utils/helper.js';

// Maximum allowed length for a search query to bound regex work.
const MAX_QUERY_LENGTH = 100;

class SearchService {
    /**
     * Search across courses and course bundles
     * @param {Object} options - Search options
     * @param {string} options.query - Search query
     * @param {string} options.type - Type filter ('all', 'course', 'bundle')
     * @param {number} options.page - Page number
     * @param {number} options.limit - Items per page
     * @param {string} options.sortBy - Sort criteria
     * @param {Object} options.filters - Additional filters
     * @returns {Object} Search results with pagination
     */
    async searchContent(options = {}) {
        const {
            query = '',
            type = 'all',
            page = 1,
            limit = 10,
            sortBy = 'relevance',
            filters = {}
        } = options;

        if (!query.trim()) {
            throw new Error('Search query is required');
        }

        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum;

        // Create search regex for case-insensitive search.
        // Escape user input and cap length to avoid ReDoS / catastrophic backtracking.
        const trimmedQuery = query.trim().slice(0, MAX_QUERY_LENGTH);
        const searchRegex = new RegExp(escapeRegex(trimmedQuery), 'i');

        let results = [];

        // Search in courses
        if (type === 'all' || type === 'course') {
            const courses = await this.searchCourses(searchRegex, filters);
            results = [...results, ...courses];
        }

        // Search in course bundles
        if (type === 'all' || type === 'bundle') {
            const bundles = await this.searchBundles(searchRegex, filters);
            results = [...results, ...bundles];
        }

        // Sort results
        results = this.sortResults(results, sortBy, query);

        const totalCount = results.length;

        // Apply pagination
        const paginatedResults = results.slice(skip, skip + limitNum);

        // Calculate statistics
        const stats = {
            total: totalCount,
            courses: results.filter(item => item.type === 'course').length,
            bundles: results.filter(item => item.type === 'bundle').length,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(totalCount / limitNum)
        };

        return {
            results: paginatedResults,
            stats,
            searchQuery: query,
            filters: { type, sortBy }
        };
    }

    /**
     * Search courses
     * @param {RegExp} searchRegex - Search regex pattern
     * @param {Object} filters - Additional filters
     * @returns {Array} Array of courses with type identifier
     */
    async searchCourses(searchRegex, filters = {}) {
        const searchQuery = {
            isDeleted: false,
            isPublished: true,
            $or: [
                { title: searchRegex },
                { description: searchRegex },
                { shortDescription: searchRegex },
                { tags: { $in: [searchRegex] } }
            ]
        };

        // Apply additional filters
        if (filters.categoryId) {
            searchQuery.categoryId = filters.categoryId;
        }
        if (filters.level) {
            searchQuery.level = { $in: Array.isArray(filters.level) ? filters.level : [filters.level] };
        }
        if (filters.minPrice !== undefined) {
            searchQuery.price = { $gte: parseFloat(filters.minPrice) };
        }
        if (filters.maxPrice !== undefined) {
            searchQuery.price = { ...searchQuery.price, $lte: parseFloat(filters.maxPrice) };
        }

        // Fetch courses and populate plans
        const courses = await Course.find(searchQuery)
            .populate('categoryId', 'name')
            .populate('subCategoryId', 'name')
            .populate('instructorId', 'name email')
            .select('title slug description shortDescription thumbnail price salePrice discountPrice duration totalLessons level tags categoryId subCategoryId instructorId createdAt salesCount currentEnrollments')
            .lean();

        // Populate CoursePlans for each course
        const courseIds = courses.map(c => c._id);
        const plans = await CoursePlan.find({ courseId: { $in: courseIds } }).lean();
        const plansByCourse = {};
        plans.forEach(plan => {
            const cid = plan.courseId?.toString?.() || plan.courseId;
            if (!plansByCourse[cid]) plansByCourse[cid] = [];
            plansByCourse[cid].push(plan);
        });

        return courses.map(course => ({
            ...course,
            type: 'course',
            contentType: 'Individual Course',
            finalPrice: this.calculateFinalPrice(course.price, course.discountPrice),
            plans: plansByCourse[course._id.toString()] || [],
            popularity: course.salesCount || 0,
            enrollmentCount: course.currentEnrollments || 0
        }));
    }

    /**
     * Search course bundles
     * @param {RegExp} searchRegex - Search regex pattern
     * @param {Object} filters - Additional filters
     * @returns {Array} Array of bundles with type identifier
     */
    async searchBundles(searchRegex, filters = {}) {
        const searchQuery = {
            $or: [
                { title: searchRegex },
                { description: searchRegex },
                { subtitle: searchRegex },
                { tags: { $in: [searchRegex] } }
            ]
        };

        // Apply additional filters
        if (filters.level) {
            searchQuery.level = { $in: Array.isArray(filters.level) ? filters.level : [filters.level] };
        }
        if (filters.minPrice !== undefined) {
            searchQuery.price = { $gte: parseFloat(filters.minPrice) };
        }
        if (filters.maxPrice !== undefined) {
            searchQuery.price = { ...searchQuery.price, $lte: parseFloat(filters.maxPrice) };
        }

        const bundles = await CourseBundle.find(searchQuery)
            .populate('courses', 'title duration totalLessons')
            .select('title slug description subtitle thumbnail price discount level tags courses createdAt featured popular')
            .lean();

        return bundles.map(bundle => ({
            ...bundle,
            type: 'bundle',
            contentType: 'Course Bundle',
            finalPrice: this.calculateBundlePrice(bundle.price, bundle.discount),
            courseCount: bundle.courses ? bundle.courses.length : 0,
            totalLessons: bundle.courses ? bundle.courses.reduce((acc, course) => acc + (course.totalLessons || 0), 0) : 0,
            totalDuration: bundle.courses ? bundle.courses.reduce((acc, course) => acc + (course.duration || 0), 0) : 0,
            popularity: bundle.featured || bundle.popular ? 1 : 0
        }));
    }

    /**
     * Sort search results
     * @param {Array} results - Search results
     * @param {string} sortBy - Sort criteria
     * @param {string} query - Original search query for relevance sorting
     * @returns {Array} Sorted results
     */
    sortResults(results, sortBy, query) {
        switch (sortBy) {
            case 'title':
                return results.sort((a, b) => a.title.localeCompare(b.title));
            
            case 'createdAt':
                return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            case 'price':
                return results.sort((a, b) => a.finalPrice - b.finalPrice);
            
            case 'popularity':
                return results.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
            
            case 'relevance':
            default:
                return results.sort((a, b) => {
                    const queryLower = query.toLowerCase();
                    const aTitleLower = a.title.toLowerCase();
                    const bTitleLower = b.title.toLowerCase();
                    
                    // Exact title matches first
                    const aExact = aTitleLower === queryLower;
                    const bExact = bTitleLower === queryLower;
                    if (aExact && !bExact) return -1;
                    if (!aExact && bExact) return 1;
                    
                    // Title starts with query
                    const aStarts = aTitleLower.startsWith(queryLower);
                    const bStarts = bTitleLower.startsWith(queryLower);
                    if (aStarts && !bStarts) return -1;
                    if (!aStarts && bStarts) return 1;
                    
                    // Title contains query
                    const aContains = aTitleLower.includes(queryLower);
                    const bContains = bTitleLower.includes(queryLower);
                    if (aContains && !bContains) return -1;
                    if (!aContains && bContains) return 1;
                    
                    // Finally sort by title alphabetically
                    return a.title.localeCompare(b.title);
                });
        }
    }

    /**
     * Calculate final price for courses
     * @param {number} price - Original price
     * @param {number} discountPrice - Discount price
     * @returns {number} Final price
     */
    calculateFinalPrice(price, discountPrice) {
        return discountPrice || price || 0;
    }

    /**
     * Calculate final price for bundles
     * @param {number} price - Original price
     * @param {number} discount - Discount percentage
     * @returns {number} Final price
     */
    calculateBundlePrice(price, discount) {
        if (!price) return 0;
        if (!discount) return price;
        return price - (price * (discount / 100));
    }

    /**
     * Get search suggestions based on partial query
     * @param {string} query - Partial search query
     * @param {number} limit - Number of suggestions
     * @returns {Array} Array of search suggestions
     */
    async getSearchSuggestions(query, limit = 5) {
        if (!query || query.length < 2) {
            return [];
        }

        // Escape user input and cap length to avoid ReDoS / catastrophic backtracking.
        const trimmedQuery = query.trim().slice(0, MAX_QUERY_LENGTH);
        const searchRegex = new RegExp(escapeRegex(trimmedQuery), 'i');
        const suggestions = new Set();

        // Get course titles
        const courses = await Course.find({
            isDeleted: false,
            isPublished: true,
            title: searchRegex
        })
        .select('title')
        .limit(limit)
        .lean();

        courses.forEach(course => suggestions.add(course.title));

        // Get bundle titles
        const bundles = await CourseBundle.find({
            title: searchRegex
        })
        .select('title')
        .limit(limit)
        .lean();

        bundles.forEach(bundle => suggestions.add(bundle.title));

        return Array.from(suggestions).slice(0, limit);
    }
}

export default new SearchService();
