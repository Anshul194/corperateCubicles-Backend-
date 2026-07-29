import Enrollment from '../models/CourseEnrollment.js';

const canManageJobPosts = async (req, res, next) => {
    try {
        // If user is admin, allow access
        if (req.user.role === 'admin' || req.user.roles?.includes('admin')) {
            return next();
        }

        console?.log('User roles:', req.user.roles);
        
        // Check if user has any active enrollments
        const activeEnrollment = await Enrollment.findOne({ 
            userId: req.user._id,
            status: 'active'
        });
        
        if (activeEnrollment) {
            return next();
        }
        
        // If no active enrollments, check for orders as fallback
        if (!activeEnrollment) {
            return res.status(403).json({
                success: false,
                message: 'You need an active course enrollment before creating job posts'
            });
        }

        next();
    } catch (error) {
        console.error('canManageJobPosts middleware error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export default canManageJobPosts;
