import Course from '../models/Course.js';
import CrudRepository from './crudRepository.js';
import mongoose from 'mongoose';
import Module from '../models/Module.js';


class CourseRepository extends CrudRepository {
  constructor() {
    super(Course);
  }

  async findBy(data) {
    try {
      const response = await Course.findOne({ ...data, isDeleted: false })
        .populate("categoryId")
        .populate("subCategoryId")
        .populate("instructorId");
      return response;
    } catch (error) {
      throw error;
    }
  }

  async findAll({
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortOrder = "desc",
    filter = {},
    search = "",
  } = {}) {
    try {
      const skip = (page - 1) * limit;

      // Initialize search query
      let searchQuery = {};

      // Handle search parameter
      if (search) {
        try {
          // Attempt to parse search as JSON (e.g., {"title":"Digital Marketing Mastery"})
          const parsedSearch = typeof search === 'string' ? JSON.parse(search) : search;

          if (parsedSearch.title) {
            // Search only by title with partial match (case-insensitive)
            searchQuery = {
              title: { $regex: parsedSearch.title, $options: "i" },
            };
          } else {
            // Fallback to original behavior if no title in parsed search
            searchQuery = {
              $or: [
                { title: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } },
                { seoMetaDescription: { $regex: search, $options: "i" } },
                { topic: { $regex: search, $options: "i" } },
                { languages: { $regex: search, $options: "i" } },
              ],
            };
          }
        } catch (e) {
          // If JSON parsing fails, treat search as a string for general search
          searchQuery = {
            $or: [
              { title: { $regex: search, $options: "i" } },
              { description: { $regex: search, $options: "i" } },
              { seoMetaDescription: { $regex: search, $options: "i" } },
              { topic: { $regex: search, $options: "i" } },
              { languages: { $regex: search, $options: "i" } },
            ],
          };
        }
      }





      // Combine filters with search and isDeleted
      const query = {
        isDeleted: false,
        ...filter,
        ...searchQuery,
      };

      // Support explicit coursePosition sorting when `courseposition` or `coursePosition` flag is passed in filter
      let useCoursePositionSort = false;

      if (
        filter &&
        (
          filter.courseposition === true ||
          filter.courseposition === 'true' ||
          filter.coursePosition === true ||
          filter.coursePosition === 'true'
        )
      ) {
        useCoursePositionSort = true;
        // remove the helper flags so they don't affect query matching
        if (filter.courseposition !== undefined) delete filter.courseposition;
        if (filter.coursePosition !== undefined) delete filter.coursePosition;
        // also ensure we remove them from the final query object (they were spread into `query` above)
        if (query && query.courseposition !== undefined) delete query.courseposition;
        if (query && query.coursePosition !== undefined) delete query.coursePosition;
      }

      // Build sort object dynamically
      const sortOptions = {};
      if (useCoursePositionSort) {
        // Always ascending for manual course position
        sortOptions['coursePosition'] = 1;
      } else {
        sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;
      }

      // Query with filter, search, pagination, and sorting
      const data = await Course.find(query)
        .populate("categoryId")
        .populate("subCategoryId")
        .populate("instructorId")
        .populate({
          path: "modules",
          populate: {
            path: "lessons",
            model: "Lesson",
            populate: [
              { path: "Quiz", model: "Quiz" },
              { path: "Assignment", model: "Assignment" },
            ],
          },
        })
        .skip(skip)
        .limit(limit)
        .sort(sortOptions);

      // Count total documents for pagination meta
      const total = await Course.countDocuments(query);

      return {
        data,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      throw error;
    }
  }

  // Add this helper function for VdoCipher API calls
  getVdoCipherOTP = async (videoId) => {
    return new Promise((resolve, reject) => {
      const request = require('request');
      const options = {
        method: 'POST',
        url: `https://dev.vdocipher.com/api/videos/${videoId}/otp`,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': import.meta.env.VIDEOCYPHER_API_KEY, // Replace with your actual API secret
        },
        body: { ttl: 300 }, // 5 minutes TTL
        json: true,
      };

      request(options, function (error, response, body) {
        if (error) {
          console.error(`VdoCipher API Error for video ${videoId}:`, error);
          reject(error);
        } else if (response.statusCode !== 200) {
          console.error(`VdoCipher API Error for video ${videoId}:`, response.statusCode, body);
          reject(new Error(`API returned status ${response.statusCode}`));
        } else {
          resolve(body);
        }
      });
    });
  };

  // Enhanced findById method with VdoCipher integration


  async findById(id) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid course ID format');
      }

      const response = await Course.aggregate([
        {
          $match: {
            _id: new mongoose.Types.ObjectId(id),
            isDeleted: false
          }
        },

        // Category Lookup
        {
          $lookup: {
            from: 'coursecategories',
            localField: 'categoryId',
            foreignField: '_id',
            as: 'category',
            pipeline: [{ $match: { isDeleted: { $ne: true } } }]
          }
        },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },

        // SubCategory Lookup
        {
          $lookup: {
            from: 'subcategories',
            localField: 'subCategoryId',
            foreignField: '_id',
            as: 'subCategory',
            pipeline: [{ $match: { isDeleted: { $ne: true } } }]
          }
        },
        { $unwind: { path: '$subCategory', preserveNullAndEmptyArrays: true } },

        // Instructor Lookup
        {
          $lookup: {
            from: 'instructors',
            localField: 'instructorId',
            foreignField: '_id',
            as: 'instructor',
            pipeline: [{ $match: { isDeleted: { $ne: true } } }]
          }
        },
        { $unwind: { path: '$instructor', preserveNullAndEmptyArrays: true } },

        // FAQs
        {
          $lookup: {
            from: 'faqs',
            let: { courseId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$courseId', '$$courseId'] },
                  isPublic: true
                }
              },
              { $sort: { sortOrder: 1, createdAt: 1 } }
            ],
            as: 'faqs'
          }
        },

        // Pricing Plan Discounts
        {
          $lookup: {
            from: 'pricingplandiscounts',
            let: { courseId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$course', '$$courseId'] },
                  isDeleted: { $ne: true }
                }
              },
              {
                $project: {
                  _id: 1,
                  language: 1,
                  title: 1,
                  startDate: 1,
                  endDate: 1,
                  discount: 1,
                  capacity: 1,
                  isDeleted: 1,
                  createdAt: 1,
                  updatedAt: 1
                }
              }
            ],
            as: 'pricingPlanDiscounts'
          }
        },

        //plans
        {
          $lookup: {
            from: 'courseplans',
            let: { courseId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$courseId', '$$courseId'] },
                  isDeleted: { $ne: true },
                }
              },
              { $sort: { order: 1 } }
            ],
            as: 'plans'
          }
        },

        // Modules (ONLY Published)
        {
          $lookup: {
            from: 'modules',
            let: { courseId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$courseId', '$$courseId'] },
                  isDeleted: { $ne: true },
                  isPublished: true // ✅ only published modules
                }
              },
              { $sort: { order: 1 } },

              // Lessons Lookup
              {
                $lookup: {
                  from: 'lessons',
                  let: { lessonIds: '$lessons' },
                  pipeline: [
                    {
                      $match: {
                        $expr: { $in: ['$_id', '$$lessonIds'] },
                        isDeleted: { $ne: true }
                      }
                    },
                    { $sort: { order: 1 } },

                    // --- VIDEO LESSON LOOKUP ---
                    {
                      $lookup: {
                        from: 'videolessons',
                        let: { lessonId: '$_id' },
                        pipeline: [
                          {
                            $match: {
                              $expr: { $eq: ['$lessonId', '$$lessonId'] },
                              isDeleted: { $ne: true }
                            }
                          },
                          {
                            $project: {
                              _id: 1,
                              lessonId: 1,
                              title: 1,
                              description: 1,
                              sourcePlatform: 1,
                              videoId: 1,
                              secureUrl: 1,
                              embedUrl: 1,
                              originalUrl: 1,
                              thumbnail: 1,
                              duration: 1,
                              fileSize: 1,
                              quality: 1,
                              status: 1,
                              isPublic: 1,
                              platformData: 1,
                              formattedDuration: {
                                $cond: {
                                  if: { $ne: ['$duration', null] },
                                  then: {
                                    $let: {
                                      vars: {
                                        hours: { $floor: { $divide: ['$duration', 3600] } },
                                        minutes: { $floor: { $divide: [{ $mod: ['$duration', 3600] }, 60] } },
                                        seconds: { $mod: ['$duration', 60] }
                                      },
                                      in: {
                                        $cond: {
                                          if: { $gt: ['$$hours', 0] },
                                          then: {
                                            $concat: [
                                              { $toString: '$$hours' }, ':',
                                              {
                                                $cond: {
                                                  if: { $lt: ['$$minutes', 10] },
                                                  then: { $concat: ['0', { $toString: '$$minutes' }] },
                                                  else: { $toString: '$$minutes' }
                                                }
                                              }, ':',
                                              {
                                                $cond: {
                                                  if: { $lt: ['$$seconds', 10] },
                                                  then: { $concat: ['0', { $toString: '$$seconds' }] },
                                                  else: { $toString: '$$seconds' }
                                                }
                                              }
                                            ]
                                          },
                                          else: {
                                            $concat: [
                                              { $toString: '$$minutes' }, ':',
                                              {
                                                $cond: {
                                                  if: { $lt: ['$$seconds', 10] },
                                                  then: { $concat: ['0', { $toString: '$$seconds' }] },
                                                  else: { $toString: '$$seconds' }
                                                }
                                              }
                                            ]
                                          }
                                        }
                                      }
                                    }
                                  },
                                  else: null
                                }
                              },
                              readableFileSize: {
                                $cond: {
                                  if: { $ne: ['$fileSize', null] },
                                  then: {
                                    $let: {
                                      vars: {
                                        sizeInKB: { $divide: ['$fileSize', 1024] },
                                        sizeInMB: { $divide: ['$fileSize', 1048576] },
                                        sizeInGB: { $divide: ['$fileSize', 1073741824] }
                                      },
                                      in: {
                                        $cond: [
                                          { $gte: ['$$sizeInGB', 1] },
                                          { $concat: [{ $toString: { $round: ['$$sizeInGB', 1] } }, ' GB'] },
                                          {
                                            $cond: [
                                              { $gte: ['$$sizeInMB', 1] },
                                              { $concat: [{ $toString: { $round: ['$$sizeInMB', 1] } }, ' MB'] },
                                              {
                                                $cond: [
                                                  { $gte: ['$$sizeInKB', 1] },
                                                  { $concat: [{ $toString: { $round: ['$$sizeInKB', 1] } }, ' KB'] },
                                                  { $concat: [{ $toString: '$fileSize' }, ' B'] }
                                                ]
                                              }
                                            ]
                                          }
                                        ]
                                      }
                                    }
                                  },
                                  else: null
                                }
                              },
                              createdAt: 1,
                              updatedAt: 1
                            }
                          },
                          { $sort: { createdAt: -1 } }
                        ],
                        as: 'videoLessons'
                      }
                    },

                    // --- DRIP RULES, QUIZZES, ASSIGNMENTS, FILES, TEXT LESSONS ---
                    // (your existing lesson lookups unchanged)
                    {
                      $lookup: {
                        from: 'quizzes',
                        localField: 'Quiz',
                        foreignField: '_id',
                        as: 'quiz',
                        pipeline: [
                          {
                            $match: {
                              isDeleted: { $ne: true }
                            }
                          },
                          {
                            $project: {
                              _id: 1,
                              course: 1,
                              lesson: 1,
                              quizTitle: 1,
                              quizDescription: 1,
                              totalMarks: 1,
                              timeLimit: 1,
                              level: 1,
                              isTestSeries: 1,
                              passMark: 1,
                              sections: {
                                $map: {
                                  input: '$sections',
                                  as: 'section',
                                  in: {
                                    sectionTitle: '$$section.sectionTitle',
                                    sectionDescription: '$$section.sectionDescription',
                                    questions: {
                                      $map: {
                                        input: '$$section.questions',
                                        as: 'q',
                                        in: {
                                          question: '$$q.question',
                                          options: '$$q.options',
                                          correctAnswer: '$$q.correctAnswer',
                                          hasCorrectAnswer: { $ne: ['$$q.correctAnswer', null] }
                                        }
                                      }
                                    }
                                  }
                                }
                              },
                              questions: {
                                $cond: {
                                  if: { $ifNull: ['$questions', false] },
                                  then: {
                                    $map: {
                                      input: '$questions',
                                      as: 'q',
                                      in: {
                                        question: '$$q.question',
                                        options: '$$q.options',
                                        correctAnswer: '$$q.correctAnswer',
                                        hasCorrectAnswer: { $ne: ['$$q.correctAnswer', null] }
                                      }
                                    }
                                  },
                                  else: null
                                }
                              },
                              createdAt: 1,
                              updatedAt: 1
                            }
                          }
                        ]
                      }
                    },
                    { $unwind: { path: '$quiz', preserveNullAndEmptyArrays: true } },
                    {
                      $lookup: {
                        from: 'assignments',
                        let: { lessonId: '$_id' },
                        pipeline: [
                          {
                            $match: {
                              $expr: { $eq: ['$lessonId', '$$lessonId'] },
                              isDeleted: { $ne: true }
                            }
                          },
                          {
                            $project: {
                              _id: 1,
                              courseId: 1,
                              lessonId: 1,
                              title: 1,
                              subject: 1,
                              language: 1,
                              description: 1,
                              score: 1,
                              maxScore: 1,
                              duration: 1,
                              remarks: 1,
                              status: 1,
                              attachmentFile: 1,
                              documentFile: 1,
                              createdAt: 1
                            }
                          }
                        ],
                        as: 'assignment'
                      }
                    },
                    { $unwind: { path: '$assignment', preserveNullAndEmptyArrays: true } },
                    {
                      $lookup: {
                        from: 'files',
                        let: { lessonId: '$_id' },
                        pipeline: [
                          {
                            $match: {
                              $expr: { $eq: ['$lessonId', '$$lessonId'] },
                              isDeleted: { $ne: true }
                            }
                          }
                        ],
                        as: 'files'
                      }
                    },
                    {
                      $lookup: {
                        from: 'textlessons',
                        let: { lessonId: '$_id' },
                        pipeline: [
                          {
                            $match: {
                              $expr: { $eq: ['$lesson', '$$lessonId'] },
                              isActive: true
                            }
                          },
                          {
                            $project: {
                              _id: 1,
                              title: 1,
                              subTitle: 1,
                              language: 1,
                              accessibility: 1,
                              attachments: 1,
                              summary: 1,
                              content: 1,
                              order: 1,
                              isActive: 1,
                              createdAt: 1,
                              updatedAt: 1
                            }
                          }
                        ],
                        as: 'textLessons'
                      }
                    },
                    {
                      $lookup: {
                        from: 'driprules',
                        let: { lessonId: '$_id' },
                        pipeline: [
                          {
                            $match: {
                              $expr: {
                                $or: [
                                  { $eq: ['$referenceId', '$$lessonId'] },
                                  { $eq: ['$targetId', '$$lessonId'] }
                                ]
                              }
                            }
                          }
                        ],
                        as: 'lessonDripRules'
                      }
                    },

                    {
                      $lookup: {
                        from: 'driptargets',
                        let: { lessonId: '$_id' },
                        pipeline: [
                          {
                            $match: {
                              $expr: {
                                $and: [
                                  { $eq: ['$targetId', '$$lessonId'] },
                                  { $eq: ['$targetType', 'lesson'] }
                                ]
                              }
                            }
                          },
                          {
                            $lookup: {
                              from: 'driprules',
                              localField: 'dripRuleId',
                              foreignField: '_id',
                              as: 'dripRuleDetails'
                            }
                          },
                          { $unwind: { path: '$dripRuleDetails', preserveNullAndEmptyArrays: true } },
                          {
                            $project: {
                              _id: 1,
                              dripRuleId: 1,
                              targetType: 1,
                              targetId: 1,
                              createdAt: 1,
                              updatedAt: 1,
                              dripType: '$dripRuleDetails.dripType',
                              delayDays: '$dripRuleDetails.delayDays',
                              referenceType: '$dripRuleDetails.referenceType',
                              referenceId: '$dripRuleDetails.referenceId',
                              unlockDate: '$dripRuleDetails.unlockDate',
                              requiredScore: '$dripRuleDetails.requiredScore',
                              conditionOperator: '$dripRuleDetails.conditionOperator'
                            }
                          }
                        ],
                        as: 'dripRules'
                      }
                    },

                    // (keep your quiz, assignment, files, textLessons, lessonDripRules lookups here)
                  ],
                  as: 'lessons'
                }
              },

              // --- Module-level drip rules ---
              {
                $lookup: {
                  from: 'driptargets',
                  let: { moduleId: '$_id' },
                  pipeline: [
                    {
                      $match: {
                        $expr: {
                          $and: [
                            { $eq: ['$targetId', '$$moduleId'] },
                            { $eq: ['$targetType', 'module'] }
                          ]
                        }
                      }
                    },
                    {
                      $lookup: {
                        from: 'driprules',
                        localField: 'dripRuleId',
                        foreignField: '_id',
                        as: 'dripRuleDetails'
                      }
                    },
                    { $unwind: { path: '$dripRuleDetails', preserveNullAndEmptyArrays: true } },
                    {
                      $project: {
                        _id: 1,
                        dripRuleId: 1,
                        targetType: 1,
                        targetId: 1,
                        createdAt: 1,
                        updatedAt: 1,
                        dripType: '$dripRuleDetails.dripType',
                        delayDays: '$dripRuleDetails.delayDays',
                        referenceType: '$dripRuleDetails.referenceType',
                        referenceId: '$dripRuleDetails.referenceId',
                        unlockDate: '$dripRuleDetails.unlockDate',
                        requiredScore: '$dripRuleDetails.requiredScore',
                        conditionOperator: '$dripRuleDetails.conditionOperator'
                      }
                    }
                  ],
                  as: 'moduleDripRules'
                }
              },

              {
                $project: {
                  title: 1,
                  description: 1,
                  image: 1,
                  objectives: 1,
                  order: 1,
                  unlockConditions: 1,
                  estimatedDuration: 1,
                  isPublished: 1,
                  unlockDate: 1,
                  lessons: 1,
                  moduleDripRules: 1,
                  createdAt: 1,
                  updatedAt: 1
                }
              }
            ],
            as: 'modules'
          }
        },

        // --- Course-level drip rules, Calculated fields, and $project ---
        // (same as your existing code)

        {
          $lookup: {
            from: 'driptargets',
            let: { courseId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$targetId', '$$courseId'] },
                      { $eq: ['$targetType', 'course'] }
                    ]
                  }
                }
              },
              {
                $lookup: {
                  from: 'driprules',
                  localField: 'dripRuleId',
                  foreignField: '_id',
                  as: 'dripRuleDetails'
                }
              },
              { $unwind: { path: '$dripRuleDetails', preserveNullAndEmptyArrays: true } },
              {
                $project: {
                  _id: 1,
                  dripRuleId: 1,
                  targetType: 1,
                  targetId: 1,
                  createdAt: 1,
                  updatedAt: 1,
                  dripType: '$dripRuleDetails.dripType',
                  delayDays: '$dripRuleDetails.delayDays',
                  referenceType: '$dripRuleDetails.referenceType',
                  referenceId: '$dripRuleDetails.referenceId',
                  unlockDate: '$dripRuleDetails.unlockDate',
                  requiredScore: '$dripRuleDetails.requiredScore',
                  conditionOperator: '$dripRuleDetails.conditionOperator'
                }
              }
            ],
            as: 'courseDripRules'
          }
        },

        // Calculated fields
        {
          $addFields: {
            totalModules: { $size: '$modules' },
            totalLessons: {
              $sum: {
                $map: {
                  input: '$modules',
                  as: 'module',
                  in: { $size: '$$module.lessons' }
                }
              }
            },
            totalVideoLessons: {
              $sum: {
                $map: {
                  input: '$modules',
                  as: 'module',
                  in: {
                    $sum: {
                      $map: {
                        input: '$$module.lessons',
                        as: 'lesson',
                        in: { $size: { $ifNull: ['$$lesson.videoLessons', []] } }
                      }
                    }
                  }
                }
              }
            },
            totalTextLessons: {
              $sum: {
                $map: {
                  input: '$modules',
                  as: 'module',
                  in: {
                    $sum: {
                      $map: {
                        input: '$$module.lessons',
                        as: 'lesson',
                        in: { $size: { $ifNull: ['$$lesson.textLessons', []] } }
                      }
                    }
                  }
                }
              }
            },
            totalVideoDuration: {
              $sum: {
                $map: {
                  input: '$modules',
                  as: 'module',
                  in: {
                    $sum: {
                      $map: {
                        input: '$$module.lessons',
                        as: 'lesson',
                        in: {
                          $sum: {
                            $map: {
                              input: { $ifNull: ['$$lesson.videoLessons', []] },
                              as: 'video',
                              in: { $ifNull: ['$$video.duration', 0] }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            videosByPlatform: {
              $let: {
                vars: {
                  allVideos: {
                    $reduce: {
                      input: '$modules',
                      initialValue: [],
                      in: {
                        $concatArrays: [
                          '$$value',
                          {
                            $reduce: {
                              input: '$$this.lessons',
                              initialValue: [],
                              in: {
                                $concatArrays: [
                                  '$$value',
                                  { $ifNull: ['$$this.videoLessons', []] }
                                ]
                              }
                            }
                          }
                        ]
                      }
                    }
                  }
                },
                in: {
                  $arrayToObject: {
                    $map: {
                      input: {
                        $setUnion: [{ $map: { input: '$$allVideos', as: 'v', in: '$$v.sourcePlatform' } }]
                      },
                      as: 'platform',
                      in: {
                        k: '$$platform',
                        v: {
                          $size: {
                            $filter: {
                              input: '$$allVideos',
                              as: 'v',
                              cond: { $eq: ['$$v.sourcePlatform', '$$platform'] }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            totalDripRules: {
              $add: [
                { $size: { $ifNull: ['$courseDripRules', []] } },
                {
                  $sum: {
                    $map: {
                      input: '$modules',
                      as: 'module',
                      in: {
                        $add: [
                          { $size: { $ifNull: ['$$module.moduleDripRules', []] } },
                          {
                            $sum: {
                              $map: {
                                input: '$$module.lessons',
                                as: 'lesson',
                                in: {
                                  $add: [
                                    { $size: { $ifNull: ['$$lesson.dripRules', []] } },
                                    { $size: { $ifNull: ['$$lesson.lessonDripRules', []] } }
                                  ]
                                }
                              }
                            }
                          }
                        ]
                      }
                    }
                  }
                }
              ]
            },
            estimatedTotalDuration: {
              $sum: {
                $map: {
                  input: '$modules',
                  as: 'module',
                  in: {
                    $sum: {
                      $map: {
                        input: '$$module.lessons',
                        as: 'lesson',
                        in: { $ifNull: ['$$lesson.duration', 0] }
                      }
                    }
                  }
                }
              }
            }
          }
        },

        {
          $project: {
            categoryId: 0,
            subCategoryId: 0,
            instructorId: 0
          }
        }
      ]);


      if (!response || response.length === 0) return null;

      const course = response[0];

      // Sort modules by order ascending
      if (course.modules && Array.isArray(course.modules)) {
        course.modules.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        // Sort lessons in each module by order ascending
        for (const module of course.modules) {
          if (module.lessons && Array.isArray(module.lessons)) {
            module.lessons.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          }
        }
      }

      // Post-process to add VdoCipher OTP data to video lessons
      if (course.modules && course.modules.length > 0) {
        await Promise.all(
          course.modules.map(async (module) => {
            if (module.lessons && module.lessons.length > 0) {
              await Promise.all(
                module.lessons.map(async (lesson) => {
                  if (lesson.videoLessons && lesson.videoLessons.length > 0) {
                    await Promise.all(
                      lesson.videoLessons.map(async (videoLesson) => {
                        // Only fetch OTP for VdoCipher videos
                        if (videoLesson.sourcePlatform === 'vdocipher' && videoLesson.videoId) {
                          try {
                            const vdoCipherData = await getVdoCipherOTP(videoLesson.videoId);

                            // Add VdoCipher playback data to the video lesson
                            videoLesson.vdoCipherPlayback = {
                              otp: vdoCipherData.otp,
                              playbackInfo: vdoCipherData.playbackInfo,
                              ttl: vdoCipherData.ttl || 300,
                              fetchedAt: new Date().toISOString()
                            };
                          } catch (error) {
                            console.error(`Failed to fetch VdoCipher OTP for video ${videoLesson.videoId}:`, error);

                            // Add error info instead of failing completely
                            videoLesson.vdoCipherPlayback = {
                              error: 'Failed to fetch playback info',
                              errorMessage: error.message,
                              fetchedAt: new Date().toISOString()
                            };
                          }
                        }
                      })
                    );
                  }
                })
              );
            }
          })
        );
      }

      // Ensure every lesson of type "quiz" has a quiz property
      if (course.modules && Array.isArray(course.modules)) {
        for (const module of course.modules) {
          if (module.lessons && Array.isArray(module.lessons)) {
            for (const lesson of module.lessons) {
              if (
                lesson.type === "quiz" &&
                !lesson.quiz // If quiz property is missing
              ) {
                // Try to find a quiz by lesson._id
                const quiz = await mongoose.model('Quiz').findOne({
                  lesson: lesson._id,
                  isDeleted: { $ne: true }
                }).lean();
                if (quiz) {
                  lesson.quiz = quiz;
                }
              }
            }
          }
        }
      }

      return course;
    } catch (error) {
      console.error('Error in findById:', error.message);
      throw new Error(`Failed to fetch course: ${error.message}`);
    }
  }

  async findBySlug(slug) {
    try {
      if (!slug || typeof slug !== 'string') {
        throw new Error('Invalid course slug format');
      }

      const response = await Course.aggregate([
        {
          $match: {
            slug: slug,
            isDeleted: false
          }
        },

        // Category Lookup
        {
          $lookup: {
            from: 'coursecategories',
            localField: 'categoryId',
            foreignField: '_id',
            as: 'category',
            pipeline: [{ $match: { isDeleted: { $ne: true } } }]
          }
        },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },

        // SubCategory Lookup
        {
          $lookup: {
            from: 'subcategories',
            localField: 'subCategoryId',
            foreignField: '_id',
            as: 'subCategory',
            pipeline: [{ $match: { isDeleted: { $ne: true } } }]
          }
        },
        { $unwind: { path: '$subCategory', preserveNullAndEmptyArrays: true } },

        // Instructor Lookup
        {
          $lookup: {
            from: 'instructors',
            localField: 'instructorId',
            foreignField: '_id',
            as: 'instructor',
            pipeline: [{ $match: { isDeleted: { $ne: true } } }]
          }
        },
        { $unwind: { path: '$instructor', preserveNullAndEmptyArrays: true } },

        // plans
        {
          $lookup: {
            from: 'courseplans',
            let: { courseId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$courseId', '$$courseId'] },
                  isDeleted: { $ne: true }
                }
              },
              { $sort: { order: 1 } }
            ],
            as: 'plans'
          }
        },

        // Module + Lesson Lookup
        {
          $lookup: {
            from: 'modules',
            let: { courseId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$courseId', '$$courseId'] },
                  isDeleted: { $ne: true }
                }
              },
              { $sort: { order: 1 } },

              {
                $lookup: {
                  from: 'lessons',
                  let: { lessonIds: '$lessons' },
                  pipeline: [
                    {
                      $match: {
                        $expr: { $in: ['$_id', '$$lessonIds'] },
                        isDeleted: { $ne: true }
                      }
                    },
                    { $sort: { order: 1 } },

                    // VIDEO LESSON LOOKUP
                    {
                      $lookup: {
                        from: 'videolessons',
                        let: { lessonId: '$_id' },
                        pipeline: [
                          {
                            $match: {
                              $expr: { $eq: ['$lessonId', '$$lessonId'] },
                              isDeleted: { $ne: true }
                            }
                          },
                          {
                            $project: {
                              _id: 1,
                              lessonId: 1,
                              title: 1,
                              description: 1,
                              sourcePlatform: 1,
                              videoId: 1,
                              secureUrl: 1,
                              embedUrl: 1,
                              originalUrl: 1,
                              thumbnail: 1,
                              duration: 1,
                              fileSize: 1,
                              quality: 1,
                              status: 1,
                              isPublic: 1,
                              platformData: 1,
                              formattedDuration: {
                                $cond: {
                                  if: { $ne: ['$duration', null] },
                                  then: {
                                    $let: {
                                      vars: {
                                        hours: { $floor: { $divide: ['$duration', 3600] } },
                                        minutes: { $floor: { $divide: [{ $mod: ['$duration', 3600] }, 60] } },
                                        seconds: { $mod: ['$duration', 60] }
                                      },
                                      in: {
                                        $cond: {
                                          if: { $gt: ['$$hours', 0] },
                                          then: {
                                            $concat: [
                                              { $toString: '$$hours' },
                                              ':',
                                              {
                                                $cond: {
                                                  if: { $lt: ['$$minutes', 10] },
                                                  then: { $concat: ['0', { $toString: '$$minutes' }] },
                                                  else: { $toString: '$$minutes' }
                                                }
                                              },
                                              ':',
                                              {
                                                $cond: {
                                                  if: { $lt: ['$$seconds', 10] },
                                                  then: { $concat: ['0', { $toString: '$$seconds' }] },
                                                  else: { $toString: '$$seconds' }
                                                }
                                              }
                                            ]
                                          },
                                          else: {
                                            $concat: [
                                              { $toString: '$$minutes' },
                                              ':',
                                              {
                                                $cond: {
                                                  if: { $lt: ['$$seconds', 10] },
                                                  then: { $concat: ['0', { $toString: '$$seconds' }] },
                                                  else: { $toString: '$$seconds' }
                                                }
                                              }
                                            ]
                                          }
                                        }
                                      }
                                    }
                                  },
                                  else: null
                                }
                              },
                              readableFileSize: {
                                $cond: {
                                  if: { $ne: ['$fileSize', null] },
                                  then: {
                                    $let: {
                                      vars: {
                                        sizeInKB: { $divide: ['$fileSize', 1024] },
                                        sizeInMB: { $divide: ['$fileSize', 1048576] },
                                        sizeInGB: { $divide: ['$fileSize', 1073741824] }
                                      },
                                      in: {
                                        $cond: [
                                          { $gte: ['$$sizeInGB', 1] },
                                          { $concat: [{ $toString: { $round: ['$$sizeInGB', 1] } }, ' GB'] },
                                          {
                                            $cond: [
                                              { $gte: ['$$sizeInMB', 1] },
                                              { $concat: [{ $toString: { $round: ['$$sizeInMB', 1] } }, ' MB'] },
                                              {
                                                $cond: [
                                                  { $gte: ['$$sizeInKB', 1] },
                                                  { $concat: [{ $toString: { $round: ['$$sizeInKB', 1] } }, ' KB'] },
                                                  { $concat: [{ $toString: '$fileSize' }, ' B'] }
                                                ]
                                              }
                                            ]
                                          }
                                        ]
                                      }
                                    }
                                  },
                                  else: null
                                }
                              },
                              createdAt: 1,
                              updatedAt: 1
                            }
                          },
                          { $sort: { createdAt: -1 } }
                        ],
                        as: 'videoLessons'
                      }
                    },

                    // DRIP RULE LOOKUP
                    {
                      $lookup: {
                        from: 'driprules',
                        let: { lessonId: '$_id' },
                        pipeline: [
                          {
                            $match: {
                              $expr: {
                                $and: [
                                  { $eq: ['$targetId', '$$lessonId'] },
                                  { $eq: ['$targetType', 'lesson'] }
                                ]
                              }
                            }
                          },
                          {
                            $project: {
                              _id: 1,
                              dripType: 1,
                              delayDays: 1,
                              referenceType: 1,
                              referenceId: 1,
                              targetType: 1,
                              targetId: 1,
                              unlockDate: 1,
                              requiredScore: 1,
                              conditionOperator: 1,
                              createdAt: 1,
                              updatedAt: 1
                            }
                          }
                        ],
                        as: 'dripRules'
                      }
                    },

                    // Quiz Lookup
                    {
                      $lookup: {
                        from: 'quizzes',
                        localField: 'Quiz',
                        foreignField: '_id',
                        as: 'quiz',
                        pipeline: [
                          {
                            $match: {
                              isDeleted: { $ne: true }
                            }
                          },
                          {
                            $project: {
                              _id: 1,
                              course: 1,
                              lesson: 1,
                              quizTitle: 1,
                              quizDescription: 1,
                              totalMarks: 1,
                              timeLimit: 1,
                              level: 1,
                              isTestSeries: 1,
                              passMark: 1,
                              sections: {
                                $map: {
                                  input: '$sections',
                                  as: 'section',
                                  in: {
                                    sectionTitle: '$$section.sectionTitle',
                                    sectionDescription: '$$section.sectionDescription',
                                    questions: {
                                      $map: {
                                        input: '$$section.questions',
                                        as: 'q',
                                        in: {
                                          question: '$$q.question',
                                          options: '$$q.options',
                                          correctAnswer: '$$q.correctAnswer',
                                          hasCorrectAnswer: { $ne: ['$$q.correctAnswer', null] }
                                        }
                                      }
                                    }
                                  }
                                }
                              },
                              questions: {
                                $cond: {
                                  if: { $ifNull: ['$questions', false] },
                                  then: {
                                    $map: {
                                      input: '$questions',
                                      as: 'q',
                                      in: {
                                        question: '$$q.question',
                                        options: '$$q.options',
                                        correctAnswer: '$$q.correctAnswer',
                                        hasCorrectAnswer: { $ne: ['$$q.correctAnswer', null] }
                                      }
                                    }
                                  },
                                  else: null
                                }
                              },
                              createdAt: 1,
                              updatedAt: 1
                            }
                          }
                        ],
                        as: 'quiz'
                      }
                    },
                    { $unwind: { path: '$quiz', preserveNullAndEmptyArrays: true } },

                    // Assignment Lookup
                    {
                      $lookup: {
                        from: 'assignments',
                        let: { lessonId: '$_id' },
                        pipeline: [
                          {
                            $match: {
                              $expr: { $eq: ['$lessonId', '$$lessonId'] },
                              isDeleted: { $ne: true }
                            }
                          },
                          {
                            $project: {
                              _id: 1,
                              courseId: 1,
                              lessonId: 1,
                              title: 1,
                              subject: 1,
                              language: 1,
                              description: 1,
                              score: 1,
                              maxScore: 1,
                              duration: 1,
                              remarks: 1,
                              status: 1,
                              attachmentFile: 1,
                              documentFile: 1,
                              createdAt: 1
                            }
                          }
                        ],
                        as: 'assignment'
                      }
                    },
                    { $unwind: { path: '$assignment', preserveNullAndEmptyArrays: true } },

                    // File Lookup
                    {
                      $lookup: {
                        from: 'files',
                        let: { lessonId: '$_id' },
                        pipeline: [
                          {
                            $match: {
                              $expr: { $eq: ['$lessonId', '$$lessonId'] },
                              isDeleted: { $ne: true }
                            }
                          }
                        ],
                        as: 'files'
                      }
                    },

                    // TextLesson Lookup
                    {
                      $lookup: {
                        from: 'textlessons',
                        let: { lessonId: '$_id' },
                        pipeline: [
                          {
                            $match: {
                              $expr: { $eq: ['$lesson', '$$lessonId'] },
                              isActive: true
                            }
                          },
                          {
                            $project: {
                              _id: 1,
                              title: 1,
                              subTitle: 1,
                              language: 1,
                              accessibility: 1,
                              attachments: 1,
                              summary: 1,
                              content: 1,
                              order: 1,
                              isActive: 1,
                              createdAt: 1,
                              updatedAt: 1
                            }
                          }
                        ],
                        as: 'textLessons'
                      }
                    },

                    {
                      $lookup: {
                        from: 'driprules',
                        let: { lessonId: '$_id' },
                        pipeline: [
                          {
                            $match: {
                              $expr: {
                                $or: [
                                  { $eq: ['$referenceId', '$$lessonId'] },
                                  { $eq: ['$targetId', '$$lessonId'] }
                                ]
                              }
                            }
                          }
                        ],
                        as: 'lessonDripRules'
                      }
                    }
                  ],
                  as: 'lessons'
                }
              },

              // Module-level drip rules lookup
              {
                $lookup: {
                  from: 'driprules',
                  let: { moduleId: '$_id' },
                  pipeline: [
                    {
                      $match: {
                        $expr: {
                          $and: [
                            { $eq: ['$targetId', '$$moduleId'] },
                            { $eq: ['$targetType', 'module'] }
                          ]
                        }
                      }
                    }
                  ],
                  as: 'moduleDripRules'
                }
              },

              {
                $project: {
                  title: 1,
                  description: 1,
                  image: 1,
                  objectives: 1,
                  order: 1,
                  unlockConditions: 1,
                  estimatedDuration: 1,
                  isPublished: 1,
                  unlockDate: 1,
                  lessons: 1,
                  moduleDripRules: 1,
                  createdAt: 1,
                  updatedAt: 1
                }
              }
            ],
            as: 'modules'
          }
        },

        // Course-level drip rules lookup
        {
          $lookup: {
            from: 'driprules',
            let: { courseId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$targetId', '$$courseId'] },
                      { $eq: ['$targetType', 'course'] }
                    ]
                  }
                }
              }
            ],
            as: 'courseDripRules'
          }
        },

        // Calculated Fields
        {
          $addFields: {
            totalModules: { $size: '$modules' },
            totalLessons: {
              $sum: {
                $map: {
                  input: '$modules',
                  as: 'module',
                  in: { $size: '$$module.lessons' }
                }
              }
            },
            totalVideoLessons: {
              $sum: {
                $map: {
                  input: '$modules',
                  as: 'module',
                  in: {
                    $sum: {
                      $map: {
                        input: '$$module.lessons',
                        as: 'lesson',
                        in: { $size: { $ifNull: ['$$lesson.videoLessons', []] } }
                      }
                    }
                  }
                }
              }
            },
            totalTextLessons: {
              $sum: {
                $map: {
                  input: '$modules',
                  as: 'module',
                  in: {
                    $sum: {
                      $map: {
                        input: '$$module.lessons',
                        as: 'lesson',
                        in: { $size: { $ifNull: ['$$lesson.textLessons', []] } }
                      }
                    }
                  }
                }
              }
            },
            totalVideoDuration: {
              $sum: {
                $map: {
                  input: '$modules',
                  as: 'module',
                  in: {
                    $sum: {
                      $map: {
                        input: '$$module.lessons',
                        as: 'lesson',
                        in: {
                          $sum: {
                            $map: {
                              input: { $ifNull: ['$$lesson.videoLessons', []] },
                              as: 'video',
                              in: { $ifNull: ['$$video.duration', 0] }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            videosByPlatform: {
              $reduce: {
                input: {
                  $reduce: {
                    input: '$modules',
                    initialValue: [],
                    in: {
                      $concatArrays: [
                        '$$value',
                        {
                          $reduce: {
                            input: '$$this.lessons',
                            initialValue: [],
                            in: {
                              $concatArrays: [
                                '$$value',
                                { $ifNull: ['$$this.videoLessons', []] }
                              ]
                            }
                          }
                        }
                      ]
                    }
                  }
                },
                initialValue: {},
                in: {
                  $mergeObjects: [
                    '$$value',
                    {
                      $arrayToObject: [
                        [
                          {
                            k: '$$this.sourcePlatform',
                            v: {
                              $add: [
                                { $ifNull: [{ $getField: { field: '$$this.sourcePlatform', input: '$$value' } }, 0] },
                                1
                              ]
                            }
                          }
                        ]
                      ]
                    }
                  ]
                }
              }
            },
            totalDripRules: {
              $add: [
                { $size: { $ifNull: ['$courseDripRules', []] } },
                {
                  $sum: {
                    $map: {
                      input: '$modules',
                      as: 'module',
                      in: {
                        $add: [
                          { $size: { $ifNull: ['$$module.moduleDripRules', []] } },
                          {
                            $sum: {
                              $map: {
                                input: '$$module.lessons',
                                as: 'lesson',
                                in: {
                                  $add: [
                                    { $size: { $ifNull: ['$$lesson.dripRules', []] } },
                                    { $size: { $ifNull: ['$$lesson.lessonDripRules', []] } }
                                  ]
                                }
                              }
                            }
                          }
                        ]
                      }
                    }
                  }
                }
              ]
            },
            estimatedTotalDuration: {
              $sum: {
                $map: {
                  input: '$modules',
                  as: 'module',
                  in: {
                    $sum: {
                      $map: {
                        input: '$$module.lessons',
                        as: 'lesson',
                        in: { $ifNull: ['$$lesson.duration', 0] }
                      }
                    }
                  }
                }
              }
            }
          }
        },

        {
          $project: {
            categoryId: 0,
            subCategoryId: 0,
            instructorId: 0
          }
        }
      ]);

      if (!response || response.length === 0) return null;

      return response[0];
    } catch (error) {
      console.error('Error in findBySlug:', error.message);
      throw new Error(`Failed to fetch course: ${error.message}`);
    }
  }






  async updateById(id, updateData) {
    try {
      const updatedCourse = await Course.findOneAndUpdate(
        { _id: id, isDeleted: false },
        updateData,
        { new: true }
      )
        .populate("categoryId")
        .populate("subCategoryId")
        .populate("instructorId");
      return updatedCourse;
    } catch (error) {
      throw error;
    }
  }

  async softDeleteById(id) {
    try {
      const deletedCourse = await Course.findOneAndUpdate(
        { _id: id, isDeleted: false },
        { isDeleted: true, deletedAt: new Date() },
        { new: true }
      )
        .populate("categoryId")
        .populate("subCategoryId")
        .populate("instructorId");
      return deletedCourse;
    } catch (error) {
      throw error;
    }
  }

  async findMyCourses({
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortOrder = "desc",
    filter = {},
    search = "",
  } = {}) {
    try {
      const skip = (page - 1) * limit;

      // Build search query
      let searchQuery = {};
      if (search) {
        searchQuery = {
          $or: [
            { title: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
            { seoMetaDescription: { $regex: search, $options: "i" } },
            { topic: { $regex: search, $options: "i" } },
            { languages: { $regex: search, $options: "i" } },
          ],
        };
      }

      // Combine filters with search
      const query = {
        ...filter,
        ...searchQuery,
      };

      // Build sort object
      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

      // Query with aggregation to get additional stats
      const data = await Course.aggregate([
        { $match: query },

        // Category Lookup
        {
          $lookup: {
            from: 'coursecategories',
            localField: 'categoryId',
            foreignField: '_id',
            as: 'category',
            pipeline: [{ $match: { isDeleted: { $ne: true } } }]
          }
        },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },

        // SubCategory Lookup
        {
          $lookup: {
            from: 'subcategories',
            localField: 'subCategoryId',
            foreignField: '_id',
            as: 'subCategory',
            pipeline: [{ $match: { isDeleted: { $ne: true } } }]
          }
        },
        { $unwind: { path: '$subCategory', preserveNullAndEmptyArrays: true } },

        // Instructor Lookup
        {
          $lookup: {
            from: 'instructors',
            localField: 'instructorId',
            foreignField: '_id',
            as: 'instructor',
            pipeline: [{ $match: { isDeleted: { $ne: true } } }]
          }
        },
        { $unwind: { path: '$instructor', preserveNullAndEmptyArrays: true } },

        // Get module count
        {
          $lookup: {
            from: 'modules',
            let: { courseId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$courseId', '$$courseId'] },
                  isDeleted: { $ne: true }
                }
              },
              { $count: "count" }
            ],
            as: 'moduleStats'
          }
        },

        // Get enrollment count (if you have enrollments)
        {
          $lookup: {
            from: 'enrollments',
            let: { courseId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$courseId', '$$courseId'] },
                  status: { $in: ['active', 'completed'] }
                }
              },
              { $count: "count" }
            ],
            as: 'enrollmentStats'
          }
        },

        // Add calculated fields
        {
          $addFields: {
            totalModules: {
              $ifNull: [{ $arrayElemAt: ['$moduleStats.count', 0] }, 0]
            },
            totalEnrollments: {
              $ifNull: [{ $arrayElemAt: ['$enrollmentStats.count', 0] }, 0]
            }
          }
        },

        // Remove temporary fields
        {
          $project: {
            moduleStats: 0,
            enrollmentStats: 0,
            categoryId: 0,
            subCategoryId: 0,
            instructorId: 0
          }
        },

        { $sort: sortOptions },
        { $skip: skip },
        { $limit: limit }
      ]);

      // Count total documents for pagination
      const totalCount = await Course.aggregate([
        { $match: query },
        { $count: "total" }
      ]);

      const total = totalCount.length > 0 ? totalCount[0].total : 0;

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      throw error;
    }
  }

  async findPopularCourses(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortOrder = "desc"
      } = options;

      const skip = (page - 1) * limit;
      const sortObject = {};
      sortObject[sortBy] = sortOrder === "desc" ? -1 : 1;

      // Query for popular courses only
      const query = {
        popular: true,
        isDeleted: false
      };

      const [courses, total] = await Promise.all([
        Course.find(query)
          .populate('categoryId', 'name')
          .populate('subCategoryId', 'name')
          .populate('instructorId', 'firstName lastName email')
          .sort(sortObject)
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Course.countDocuments(query)
      ]);

      return {
        data: courses,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      throw error;
    }
  }

}

export default CourseRepository;
