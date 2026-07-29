import Coupon from '../models/Coupon.js';
import CrudRepository from './crudRepository.js';

class CouponRepository extends CrudRepository {
  constructor() {
    super(Coupon);
  }

  async findByCode(code) {
    try {
      const response = await Coupon.findOne({ 
        code: code.toUpperCase(), 
        isActive: true 
      })
      .populate('usedBy.userId', 'fullName email phone')
      .populate('applicableCourses', 'title _id');
      return response;
    } catch (error) {
      throw error;
    }
  }

  async findAll() {
    try {
      const response = await Coupon.find({})
        .populate('usedBy.userId', 'fullName email phone')
        .populate('applicableCourses', 'title _id')
        .sort({ createdAt: -1 });
      return response;
    } catch (error) {
      throw error;
    }
  }

  async findById(id) {
    try {
      const response = await Coupon.findById(id)
        .populate('usedBy.userId', 'fullName email phone')
        .populate('applicableCourses', 'title _id');
      return response;
    } catch (error) {
      throw error;
    }
  }

 async findAllWithPagination(queryConditions, sortConditions, skip, limit) {
    try {
      // First attempt with standard populate
      let coupons = await Coupon.find(queryConditions)
        .populate('usedBy.userId', 'fullName email phone')
        .populate('applicableCourses', 'title _id')
        .sort(sortConditions)
        .skip(skip)
        .limit(limit);

      // Check if we have buffer issues and try aggregation as fallback
      const hasBufferIssue = coupons.some(coupon => 
        coupon.usedBy && coupon.usedBy.some(usage => 
          usage.buffer || (usage._id && !usage.userId)
        )
      );

      if (hasBufferIssue) {
        console.log('Detected buffer issue, using aggregation pipeline...');
        
        // Use aggregation pipeline to handle buffer data
        const pipeline = [
          { $match: queryConditions },
          {
            $addFields: {
              usedBy: {
                $map: {
                  input: '$usedBy',
                  as: 'usage',
                  in: {
                    $cond: {
                      if: { $ifNull: ['$$usage.userId', false] },
                      then: '$$usage', // Keep as is if userId exists
                      else: {
                        // Try to convert buffer to ObjectId if it exists
                        _id: '$$usage._id',
                        usageCount: '$$usage.usageCount',
                        userId: null // Set to null if buffer issue
                      }
                    }
                  }
                }
              }
            }
          },
          {
            $lookup: {
              from: 'users',
              localField: 'usedBy.userId',
              foreignField: '_id',
              as: 'userDetails'
            }
          },
          {
            $addFields: {
              usedBy: {
                $map: {
                  input: '$usedBy',
                  as: 'usage',
                  in: {
                    _id: '$$usage._id',
                    usageCount: '$$usage.usageCount',
                    userId: {
                      $cond: {
                        if: { $ne: ['$$usage.userId', null] },
                        then: {
                          $let: {
                            vars: {
                              user: {
                                $arrayElemAt: [
                                  {
                                    $filter: {
                                      input: '$userDetails',
                                      cond: { $eq: ['$$this._id', '$$usage.userId'] }
                                    }
                                  },
                                  0
                                ]
                              }
                            },
                            in: {
                              _id: '$$user._id',
                              fullName: '$$user.fullName',
                              email: '$$user.email',
                              phone: '$$user.phone'
                            }
                          }
                        },
                        else: null
                      }
                    }
                  }
                }
              }
            }
          },
          { $project: { userDetails: 0 } },
          { $sort: sortConditions },
          { $skip: skip },
          { $limit: limit }
        ];

        coupons = await Coupon.aggregate(pipeline);
      }

      const total = await Coupon.countDocuments(queryConditions);
      return { coupons, total };
    } catch (error) {
      console.error('Error in findAllWithPagination:', error);
      throw error;
    }
  }

  async updateById(id, updateData) {
    try {
      const updatedCoupon = await Coupon.findByIdAndUpdate(
        id,
        updateData,
        { new: true }
      );
      return updatedCoupon;
    } catch (error) {
      throw error;
    }
  }

  async softDeleteById(id) {
    try {
      const deletedCoupon = await Coupon.findByIdAndUpdate(
        id,
        { isActive: false },
        { new: true }
      );
      return deletedCoupon;
    } catch (error) {
      throw error;
    }
  }

  async incrementUsage(couponId, userId) {
    try {
      const coupon = await Coupon.findById(couponId);
      
      if (!coupon) {
        throw new Error('Coupon not found');
      }

      // Find if user already exists in usedBy array
      const userIndex = coupon.usedBy.findIndex(
        user => user.userId.toString() === userId.toString()
      );

      if (userIndex !== -1) {
        // User exists, increment usage count
        coupon.usedBy[userIndex].usageCount += 1;
      } else {
        // New user, add to usedBy array
        coupon.usedBy.push({
          userId: userId,
          usageCount: 1
        });
      }

      await coupon.save();
      return coupon;
    } catch (error) {
      throw error;
    }
  }

  // Get coupon usage statistics
  async getCouponStats(couponId) {
    try {
      const coupon = await Coupon.findById(couponId);
      if (!coupon) {
        throw new Error('Coupon not found');
      }

      const totalUsage = coupon.usedBy.reduce((sum, user) => sum + user.usageCount, 0);
      const uniqueUsers = coupon.usedBy.length;

      return {
        totalUsage,
        uniqueUsers,
        usageLimit: coupon.usageLimit,
        remainingUsage: coupon.usageLimit > 0 ? coupon.usageLimit - totalUsage : 'Unlimited'
      };
    } catch (error) {
      throw error;
    }
  }

  // Get active coupons
  async getActiveCoupons() {
    try {
      const now = new Date();
      const activeCoupons = await Coupon.find({
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now }
      })
      .populate('usedBy.userId', 'fullName email phone')
      .populate('applicableCourses', 'title _id')
      .sort({ createdAt: -1 });

      return activeCoupons;
    } catch (error) {
      throw error;
    }
  }
}

export default CouponRepository;