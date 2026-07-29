import React, { useState, useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { createModule } from "../../store/slices/module";
import { createLesson, deleteLesson } from "../../store/slices/lesson";
import { RootState, AppDispatch } from "../../hooks/redux";

import {
  BookOpen,
  Plus,
  X,
  Bold,
  Italic,
  Underline,
  List,
  Link,
  Image,
  Video,
  Eye,
  Trash2,
  Edit,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Play,
  FileText,
  HelpCircle,
  ClipboardList,
  Clock,
  Users,
  Settings,
  ChevronDown,
  ChevronUp,
  GripVertical,
  ArrowRight,
  Folder,
  Zap,
  Package,
} from "lucide-react";

import ModulesTabContent from "../../components/course-module/ModulesTabContent";
import DripTabContent from "../../components/course-module/DripTabContent";
import AssetsTabContent from "../../components/course-module/AssetsTabContent";
import Files from "./components/Files";
import TextLesson from "./components/TextLesson";
import Quiz from "./components/Quiz";
import Assignment from "./components/Assignment";
import VedioLesson from "./components/VideoLesson";
import { useAppDispatch } from "../../hooks/redux";

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = "4xl",
  showCloseButton = true,
  footer,
}: ModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] min-h-[700px] flex bg-[#00000021] bg-opacity-70 items-center justify-center p-4 animate-fade-in">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#00000021] bg-opacity-70 transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div
        className={`relative w-full max-h-[90vh] min-h-[700px] overflow-scroll hide-scrollbar rounded-xl shadow-2xl bg-white transform scale-95 animate-scale-in
                    max-w-${maxWidth}`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50 rounded-t-xl">
          <h3 className="text-2xl font-bold text-gray-900">{title}</h3>
          {showCloseButton && (
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors duration-200"
              aria-label="Close modal"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div
          className="p-6 overflow-y-auto custom-scrollbar"
          style={{
            maxHeight:
              "calc(90vh - 120px - (var(--header-height, 0) + var(--footer-height, 0)))",
          }}
        >
          {children}
        </div>

        {/* Modal Footer (Optional) */}
        {footer && (
          <div className="sticky bottom-0 bg-gray-50 p-6 border-t border-gray-200 rounded-b-xl flex justify-end gap-3 shadow-inner">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

// Module Creation Form Component
const ModuleCreationForm = ({ onModuleCreated, courseId }) => {
  const dispatch = useDispatch();
  const { loading: moduleLoading } = useSelector((state) => state.module);

  const [moduleData, setModuleData] = useState({
    title: "",
    description: "",
    order: 1,
    estimatedDuration: 60,
    isPublished: false,
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleCreateModule = async () => {
    if (!moduleData.title.trim()) {
      alert("Please enter a module title");
      return;
    }

    setIsSaving(true);
    try {
      const token = localStorage.getItem("token") || "";
      const payload = {
        courseId,
        title: moduleData.title,
        description: moduleData.description,
        order: moduleData.order,
        estimatedDuration: moduleData.estimatedDuration,
        isPublished: moduleData.isPublished,
        token,
      };

      const result = await dispatch(createModule(payload)).unwrap();
      onModuleCreated(result.data);
    } catch (error) {
      console.error("Error creating module:", error);
      alert("Failed to create module. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white border-2 border-blue-200 rounded-2xl p-8 shadow-lg">
      <div className="text-center mb-8">
        <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
          <BookOpen className="w-8 h-8 text-blue-600" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          Create New Module
        </h3>
        <p className="text-gray-600">
          First, create your module. Then you'll be able to add lessons to it.
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Module Title *
          </label>
          <input
            type="text"
            value={moduleData.title}
            onChange={(e) =>
              setModuleData({ ...moduleData, title: e.target.value })
            }
            placeholder="e.g., Introduction to React Basics"
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Module Description
          </label>
          <textarea
            value={moduleData.description}
            onChange={(e) =>
              setModuleData({ ...moduleData, description: e.target.value })
            }
            placeholder="Describe what students will learn in this module..."
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 resize-none"
            rows={4}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estimated Duration (minutes)
            </label>
            <input
              type="number"
              value={moduleData.estimatedDuration}
              onChange={(e) =>
                setModuleData({
                  ...moduleData,
                  estimatedDuration: parseInt(e.target.value) || 60,
                })
              }
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              min="1"
              placeholder="60"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Module Order
            </label>
            <input
              type="number"
              value={moduleData.order}
              onChange={(e) =>
                setModuleData({
                  ...moduleData,
                  order: parseInt(e.target.value) || 1,
                })
              }
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              min="1"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isPublished"
            checked={moduleData.isPublished}
            onChange={(e) =>
              setModuleData({ ...moduleData, isPublished: e.target.checked })
            }
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="isPublished" className="text-gray-700 font-medium">
            Publish module immediately
          </label>
        </div>

        <div className="pt-6">
          <button
            onClick={handleCreateModule}
            disabled={isSaving || !moduleData.title.trim()}
            className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg font-semibold"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating Module...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Create Module
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const LessonEditor = ({
  lesson,
  moduleId,
  section,
  courseId,
  courseData,
  onChange,
  onRemove,
  onSave,
}) => {
  const dispatch = useDispatch();

  const [isSaving, setIsSaving] = useState(false);
  const [savedLessonId, setSavedLessonId] = useState(
    lesson._id || lesson.id || null
  );
  const [showContentModal, setShowContentModal] = useState(false);
  const [OpenLessonData, setOpenLessonData] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const getData = async (id) => {
    setShowContentModal(true);
    setOpenLessonData(lesson);
    //console.log("OpenLessonData", id);
  };
  //console.log("cours", courseData);

  // Mock loading states
  const lessonLoading = false;

  // Determine if this is a new lesson (not saved yet)
  const isNewLesson = !savedLessonId;

  // Extract content IDs based on lesson type
  // Helper to get the correct content object (e.g., quiz, assignment, etc.) by lesson type and lesson ID
  const getContentId = () => {
    // If lesson already has the content object, use its _id
    switch (lesson.type) {
      case "quiz":
        // If lesson.quiz exists, use its _id, else try to find from courseData
        if (lesson.quiz?._id) return lesson.quiz._id;
        // Try to find quiz by lesson._id in courseData
        if (courseData?.modules) {
          for (const mod of courseData.modules) {
            if (mod.lessons) {
              for (const l of mod.lessons) {
                if (l._id === lesson._id && l.quiz?._id) {
                  return l.quiz._id;
                }
              }
            }
          }
        }
        return lesson.quizId || null;
      case "assignment":
        //console.log("Assignment lesson data:", lesson);
        if (lesson.assignment?._id) return lesson.assignment._id;
        if (courseData?.modules) {
          for (const mod of courseData.modules) {
            if (mod.lessons) {
              for (const l of mod.lessons) {
                if (l._id === lesson._id && l.assignment?._id) {
                  return l.assignment._id;
                }
              }
            }
          }
        }
        return lesson.assignmentId || lesson.fileId || null;
      case "text":
        //console.log("lesson.textContent", lesson);
        //console.log("modeLessons", courseData?.modules);
        if (lesson.textLessons?._id) return lesson.textLessons._id;
        if (courseData?.modules) {
          for (const mod of courseData.modules) {
            if (mod.lessons) {
              for (const l of mod.lessons) {
                if (l._id === lesson._id && l.textLessons[0]?._id) {
                  return l.textLessons._id || l.textLessons[0]?._id;
                }
              }
            }
          }
        }
        return lesson.textLessons || lesson.textLessons || null;
      case "video":
        if (lesson.files?.[0]?._id) return lesson.files?.[0]._id;
        if (courseData?.modules) {
          for (const mod of courseData.modules) {
            if (mod.lessons) {
              for (const l of mod.lessons) {
                if (l._id === lesson?._id && l.files?._id) {
                  return l.files?.[0]?._id;
                } else {
                  return null;
                }
              }
            }
          }
        }
        return lesson._id || lesson.fileId || null;
      case "video-lesson":
        //console.log("lesson.videoLesson", lesson.videoLesson);
        if (lesson.videoLesson?._id) return lesson.videoLesson._id;
        if (courseData?.modules) {
          for (const mod of courseData.modules) {
            if (mod.lessons) {
              for (const l of mod.lessons) {
                if (l._id === lesson._id && l.videoLesson?._id) {
                  return l.videoLesson._id;
                }
              }
            }
          }
        }
        return lesson.videoLessonId || lesson.fileId || null;
      default:
        return null;
    }
  };

  const contentId = getContentId();
  const hasExistingContent = !!contentId;

  const lessonTypeConfig = {
    "video-lesson": {
      icon: Play,
      label: "video-lesson",
      color: "text-red-500 bg-red-50 border-red-200",
    },
    video: {
      icon: Play,
      label: "File",
      color: "text-red-500 bg-red-50 border-red-200",
    },
    text: {
      icon: FileText,
      label: "Text Lesson",
      color: "text-blue-500 bg-blue-50 border-blue-200",
    },
    quiz: {
      icon: HelpCircle,
      label: "Quiz",
      color: "text-green-500 bg-green-50 border-green-200",
    },
    assignment: {
      icon: ClipboardList,
      label: "Assignment",
      color: "text-purple-500 bg-purple-50 border-purple-200",
    },
  };

  const currentConfig = lessonTypeConfig[lesson.type || "video"];

  const handleSaveLesson = async () => {
    if (!lesson.title.trim()) {
      alert("Please enter a lesson title");
      return;
    }

    // Debug logging
    //console.log("Section value:", section);
    //console.log("CourseId value:", courseId);
    //console.log("ModuleId value:", moduleId);

    // Determine the correct section/courseId to use
    const sectionToUse = section || courseId || moduleId;

    if (!sectionToUse) {
      console.error("No section/courseId found. Available values:", {
        section,
        courseId,
        moduleId,
      });
      alert("Error: Missing course/section information. Please try again.");
      return;
    }

    setIsSaving(true);
    try {
      const lessonData = {
        section: sectionToUse,
        moduleId,
        title: lesson.title,
        description: lesson.content || "",
        type: lesson.type || "video",
        order: lesson.order || 1,
        isRequired: lesson.isRequired || true,
        language: "en",
      };

      //console.log("Saving lesson data:", lessonData);

      const result = await dispatch(createLesson(lessonData)).unwrap();

      // Extract lesson ID from the response
      const newLessonId = result?.data?._id || result?._id || result?.id;

      if (newLessonId) {
        setSavedLessonId(newLessonId);
        // Update the lesson object with the new ID
        const updatedLesson = { ...lesson, _id: newLessonId, id: newLessonId };
        onChange(updatedLesson);
      }

      alert("Lesson saved successfully!");
      window.location.reload();
      //console.log("Lesson saved:", result);
      onSave && onSave(result);
    } catch (error) {
      console.error("Error saving lesson:", error);
      alert("Failed to save lesson");
    } finally {
      setIsSaving(false);
    }
  };

  const renderContentModal = () => {
    // Common props for all content editors
    const commonProps = {
      sectionId: section || courseId,
      lesson: { ...lesson, _id: savedLessonId },
      onChange,
      courseId: courseId || section,
      lessonId: savedLessonId,
      moduleId: moduleId,
      contentId: contentId,
      isEdit: hasExistingContent,
    };

    switch (lesson.type) {
      case "quiz": {
        // Find quiz data and id
        let quizData = lesson.quiz;
        let quizId = lesson.quiz?._id || lesson.quizId;
        if (!quizData && courseData?.modules) {
          for (const mod of courseData.modules) {
            if (mod.lessons) {
              for (const l of mod.lessons) {
                if (l._id === lesson._id && l.quiz) {
                  quizData = l.quiz;
                  quizId = l.quiz._id;
                }
              }
            }
          }
        }
        return <Quiz {...commonProps} quizId={quizId} quizData={quizData} />;
      }
      case "assignment": {
        let assignmentData = lesson.assignment;
        let assignmentId = lesson.assignment?._id || lesson.assignmentId;
        if (!assignmentData && courseData?.modules) {
          for (const mod of courseData.modules) {
            if (mod.lessons) {
              for (const l of mod.lessons) {
                if (l._id === lesson._id && l.assignment) {
                  assignmentData = l.assignment;
                  assignmentId = l.assignment._id;
                }
              }
            }
          }
        }
        return (
          <Assignment
            {...commonProps}
            assignmentId={assignmentId}
            fileId={lesson.fileId}
            assignmentData={assignmentData}
          />
        );
      }
      case "text": {
        let textData = lesson.textContent;
        let textLessonId = lesson.textContent?._id || lesson.textLessonId;
        if (!textData && courseData?.modules) {
          for (const mod of courseData.modules) {
            if (mod.lessons) {
              for (const l of mod.lessons) {
                if (l._id === lesson._id && l.textContent) {
                  textData = l.textContent;
                  textLessonId = l.textContent._id;
                }
              }
            }
          }
        }
        return (
          <TextLesson
            {...commonProps}
            textLessonId={textLessonId}
            textData={textData}
          />
        );
      }
      case "video-lesson": {
        let videoLessonData = lesson.videoLessons;
        let videoLessonId = lesson.videoLessons?._id || lesson.videoLessonId;
        if (!videoLessonData && courseData?.modules) {
          for (const mod of courseData.modules) {
            if (mod.lessons) {
              for (const l of mod.lessons) {
                if (l._id === lesson._id && l.videoLessons) {
                  videoLessonData = l.videoLessons?.[0];
                  videoLessonId = l.videoLessons?.[0]?._id;
                }
              }
            }
          }
        }
        return (
          <VedioLesson
            {...commonProps}
            fileId={videoLessonId}
            videoData={videoLessonData}
          />
        );
      }
      case "video":
      default: {
        let videoData = lesson.video;
        let fileId = lesson.video?._id || lesson.fileId;
        if (!videoData && courseData?.modules) {
          for (const mod of courseData.modules) {
            if (mod.lessons) {
              for (const l of mod.lessons) {
                if (l._id === lesson._id && l.video) {
                  videoData = l.video;
                  fileId = l.video._id;
                }
              }
            }
          }
        }
        return <Files {...commonProps} fileId={fileId} videoData={videoData} />;
      }
    }
  };

  const getActionButtons = () => {
    if (isNewLesson) {
      return (
        <div className="text-center py-6 bg-blue-50 rounded-lg border-2 border-blue-200">
          <AlertCircle className="w-8 h-8 text-blue-600 mx-auto mb-3" />
          <h4 className="font-semibold text-blue-900 mb-2">
            Save Lesson First
          </h4>
          <p className="text-sm text-blue-700 mb-4">
            Please save the lesson to unlock content creation tools
          </p>
          <button
            onClick={handleSaveLesson}
            disabled={isSaving || !lesson.title.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving..." : "Save Lesson"}
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center space-x-3">
        <button
          onClick={() => getData(lesson)}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
            hasExistingContent
              ? "bg-amber-600 text-white hover:bg-amber-700"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          <Edit className="w-4 h-4" />
          <span>{hasExistingContent ? "Edit Content" : "Create Content"}</span>
        </button>

        {hasExistingContent && (
          <div className="flex items-center space-x-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg border border-green-200">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Content Created</span>
            <span className="text-xs text-green-600">
              ID: {contentId.substring(0, 8)}...
            </span>
          </div>
        )}

        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>
      </div>
    );
  };

  return (
    <>
      <div className="group relative">
        {/* Main Card */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 p-5">
            <div className="flex items-center justify-between">
              {/* Left Side - Lesson Info */}
              <div className="flex items-center space-x-4">
                <div
                  className={`flex items-center justify-center w-12 h-12 rounded-xl border-2 ${currentConfig?.color} transition-all duration-200`}
                >
                  {currentConfig?.icon && (
                    <currentConfig.icon className="w-6 h-6" />
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-1">
                    <h4 className="text-lg font-semibold text-gray-900">
                      {currentConfig?.label}
                    </h4>
                    {savedLessonId && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5"></div>
                        Saved
                      </span>
                    )}
                    {hasExistingContent && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Content Ready
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span className="font-medium">
                      Lesson #{lesson.order || 1}
                    </span>
                    {savedLessonId && (
                      <span className="text-xs">
                        Lesson ID: {savedLessonId.substring(0, 8)}...
                      </span>
                    )}
                    {contentId && (
                      <span className="text-xs">
                        Content ID: {contentId.substring(0, 8)}...
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Side - Actions */}
              <div className="flex items-center space-x-2">
                {/* Save Button */}
                <button
                  onClick={handleSaveLesson}
                  disabled={isSaving}
                  className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>
                    {isSaving ? "Saving..." : savedLessonId ? "Update" : "Save"}
                  </span>
                </button>

                {/* Remove Button */}
                <button
                  onClick={onRemove}
                  className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-600 transition-all duration-200"
                  title="Remove lesson"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Basic Form Section */}
          <div className="p-5 bg-white">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Lesson Title
                </label>
                <input
                  type="text"
                  value={lesson.title}
                  onChange={(e) =>
                    onChange({ ...lesson, title: e.target.value })
                  }
                  placeholder="Enter lesson title..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-base"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Lesson Type
                </label>
                <select
                  value={lesson.type || "video"}
                  onChange={(e) =>
                    onChange({ ...lesson, type: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-base"
                >
                  <option value="video-lesson">🎬 Video Lesson</option>
                  <option value="video">📹 File</option>
                  <option value="text">📄 Text Lesson</option>
                  <option value="quiz">❓ Quiz</option>
                  <option value="assignment">📋 Assignment</option>
                </select>
              </div>
            </div>

            {/* Action Buttons Section */}
            {getActionButtons()}

            {/* Settings Section */}
            {showSettings && savedLessonId && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h5 className="text-sm font-semibold text-gray-900 mb-4">
                  Lesson Settings
                </h5>
                <div className="flex flex-wrap items-center gap-6">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lesson.isRequired || true}
                      onChange={(e) =>
                        onChange({ ...lesson, isRequired: e.target.checked })
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Required Lesson
                    </span>
                  </label>

                  <div className="flex items-center space-x-3">
                    <label className="text-sm font-medium text-gray-700">
                      Display Order:
                    </label>
                    <input
                      type="number"
                      value={lesson.order || 1}
                      onChange={(e) =>
                        onChange({
                          ...lesson,
                          order: parseInt(e.target.value) || 1,
                        })
                      }
                      className="w-20 px-3 py-2 text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      min="1"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content Modal */}
      <Modal
        isOpen={showContentModal}
        onClose={() => setShowContentModal(false)}
        title={`${hasExistingContent ? "Edit" : "Create"} ${
          currentConfig?.label
        } Content`}
        maxWidth="6xl"
      >
        <div className="space-y-6">
          {/* Lesson Info Header */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {currentConfig?.icon && (
                  <currentConfig.icon className="w-6 h-6 text-gray-600" />
                )}
                <div>
                  <h4 className="font-medium text-gray-900">
                    {lesson.title || "Untitled Lesson"}
                  </h4>
                  <p className="text-sm text-gray-500">
                    Lesson ID: {savedLessonId}
                  </p>
                </div>
              </div>

              {hasExistingContent && (
                <div className="flex items-center space-x-2 px-3 py-2 bg-green-100 text-green-800 rounded-lg">
                  <CheckCircle className="w-4 h-4" />
                  <div className="text-sm font-medium">
                    <div>Edit Mode</div>
                    <div className="text-xs text-green-600">
                      Content ID: {contentId}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Content Form */}
          {renderContentModal()}

          {/* Modal Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              onClick={() => setShowContentModal(false)}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            {/* <button
              onClick={() => {
                // Save content logic here
                setShowContentModal(false);
              }}
              className={`px-6 py-2 text-white rounded-lg transition-colors ${
                hasExistingContent
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {hasExistingContent ? "Update Content" : "Save Content"}
            </button> */}
          </div>
        </div>
      </Modal>
    </>
  );
};

const SavedModuleDisplay = ({
  module,
  courseId,
  courseData,
  onAddLesson,
  onLessonChange,
  onLessonRemove,
}) => {
  const [isExpanded, setIsExpanded] = useState(false); // Changed to false by default
  const totalLessons = module.lessons?.length || 0;

  const addLesson = () => {
    const newLesson = {
      title: "",
      content: "",
      type: "video",
      order: totalLessons + 1,
      isRequired: true,
      _id: null, // Initially null, will be set after saving
    };
    onAddLesson(newLesson);
  };

  // Extract courseId from multiple possible sources
  const extractedCourseId =
    courseId ||
    module?.courseId ||
    module?.module?.courseId ||
    module?.course?.id ||
    module?.course?._id;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
      {/* Module Header - Always Visible */}
      <div
        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors duration-200"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">{module.title}</h3>
          {/* <h3 className="text-lg font-medium text-gray-900">{module.title}</h3> */}

          {/* Left Side - Module Info */}
          <div className="flex items-center space-x-3">
            {/* Chevron Icon */}
            {/* <div className="flex items-center justify-center w-6 h-6">
                            <svg 
                                className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div> */}

            {/* Module Title */}
            {/* <h3 className="text-lg font-medium text-gray-900">{module.title}</h3> */}
          </div>

          {/* Right Side - Lesson Count */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-blue-600 font-medium">
              {totalLessons} lesson{totalLessons !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center justify-center w-6 h-6">
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                  isExpanded ? "rotate-90" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Expandable Content with Smooth Animation */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? "max-h-fit opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="border-t border-gray-200 bg-gray-50">
          <div className="p-6">
            {/* Module Description */}
            {module.description && (
              <div className="mb-6">
                <p className="text-gray-600">{module.description}</p>
              </div>
            )}

            {/* Module Stats */}
            <div className="flex items-center space-x-6 mb-6 text-sm">
              <div className="flex items-center space-x-2 text-gray-600">
                <Clock className="w-4 h-4" />
                <span>{module.estimatedDuration || 60} minutes</span>
              </div>

              <div
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                  module.isPublished
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full mr-2 ${
                    module.isPublished ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                ></div>
                {module.isPublished ? "Published" : "Draft"}
              </div>
            </div>

            {/* Section Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                </div>
                <h4 className="text-xl font-semibold text-gray-900">
                  Lessons{" "}
                  {totalLessons > 0 && (
                    <span className="text-gray-500">({totalLessons})</span>
                  )}
                </h4>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  addLesson();
                }}
                className="flex items-center space-x-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm hover:shadow-md transition-all duration-200"
              >
                <Plus className="w-4 h-4" />
                <span>Add Lesson</span>
              </button>
            </div>

            {/* Lessons List */}
            <div className="space-y-6">
              {module.lessons?.map((lesson, idx) => (
                <LessonEditor
                  key={lesson._id || lesson.id || idx}
                  lesson={lesson}
                  moduleId={module?.module?._id || module?._id}
                  section={extractedCourseId}
                  courseId={extractedCourseId}
                  courseData={courseData}
                  onChange={(l) => onLessonChange(idx, l)}
                  onRemove={() => onLessonRemove(idx)}
                  onSave={(savedLesson) => {
                    // Update the lesson with the saved data
                    onLessonChange(idx, savedLesson);
                  }}
                />
              ))}

              {/* Empty State */}
              {totalLessons === 0 && (
                <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl border-2 border-dashed border-gray-300">
                  <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="w-10 h-10 text-blue-600" />
                  </div>
                  <h4 className="text-xl font-semibold text-gray-900 mb-2">
                    Ready to Create Lessons!
                  </h4>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    Your module is set up and ready. Start building your course
                    content by adding your first lesson.
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      addLesson();
                    }}
                    className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm hover:shadow-md transition-all duration-200"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Add First Lesson</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
// Main Enhanced Module Section Component
const ModuleSection = ({
  courseId,
  modules = [],
  onModulesChange,
  courseData,
  isEditing = false,
}) => {
  const { loading: moduleLoading, error: moduleError } = useSelector(
    (state) => state.module
  );
  const { loading: lessonLoading, error: lessonError } = useSelector(
    (state) => state.lesson
  );
  //console.log("courseData", courseData);

  const [savedModules, setSavedModules] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [activeTab, setActiveTab] = useState("modules"); // Add this new state
  const dispatch = useAppDispatch();

  // Initialize modules from props when component mounts or modules prop changes
  useEffect(() => {
    if (modules && modules.length > 0) {
      setSavedModules(modules);
    }
  }, [modules]);

  const handleModuleCreated = (newModule) => {
    const updatedModules = [...savedModules, { ...newModule, lessons: [] }];
    setSavedModules(updatedModules);
    setShowCreateForm(false);

    // Call parent callback if provided
    if (onModulesChange) {
      onModulesChange(updatedModules);
    }
  };

  const addLessonToModule = (moduleIndex, newLesson) => {
    const updatedModules = savedModules.map((module, idx) =>
      idx === moduleIndex
        ? { ...module, lessons: [...(module.lessons || []), newLesson] }
        : module
    );
    setSavedModules(updatedModules);

    if (onModulesChange) {
      onModulesChange(updatedModules);
    }
  };

  const updateLessonInModule = (moduleIndex, lessonIndex, updatedLesson) => {
    const updatedModules = savedModules.map((module, idx) =>
      idx === moduleIndex
        ? {
            ...module,
            lessons: (module.lessons || []).map((lesson, lIdx) =>
              lIdx === lessonIndex ? updatedLesson : lesson
            ),
          }
        : module
    );
    setSavedModules(updatedModules);

    if (onModulesChange) {
      onModulesChange(updatedModules);
    }
  };

  const removeLessonFromModule = (moduleIndex, lessonIndex) => {
    if (window.confirm("Are you sure you want to delete this lesson?")) {
      const updatedModules = savedModules.map((module, idx) =>
        idx === moduleIndex
          ? {
              ...module,
              lessons: (module.lessons || []).filter(
                (_, lIdx) => lIdx !== lessonIndex
              ),
            }
          : module
      );

      const lessonId = savedModules[moduleIndex].lessons[lessonIndex]._id;
      //console.log("Removing lesson with ID:", lessonId);
      dispatch(deleteLesson(lessonId));
      setSavedModules(updatedModules);

      if (onModulesChange) {
        onModulesChange(updatedModules);
      }
    }
  };

  const totalModules = savedModules.length;
  const publishedModules = savedModules.filter((m) => m.isPublished).length;
  const totalLessons = savedModules.reduce(
    (sum, m) => sum + (m.lessons?.length || 0),
    0
  );

  // Tab configuration
  const tabs = [
    {
      id: "modules",
      label: "Modules",
      icon: BookOpen,
      color: "blue",
    },
    {
      id: "drip",
      label: "Drip",
      icon: Zap,
      color: "purple",
    },
    {
      id: "assets",
      label: "Assets",
      icon: Package,
      color: "green",
    },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case "modules":
        return (
          <ModulesTabContent
            totalModules={totalModules}
            publishedModules={publishedModules}
            totalLessons={totalLessons}
            showCreateForm={showCreateForm}
            ModuleCreationForm={ModuleCreationForm}
            handleModuleCreated={handleModuleCreated}
            courseId={courseId}
            courseData={courseData}
            savedModules={savedModules}
            SavedModuleDisplay={SavedModuleDisplay}
            addLessonToModule={addLessonToModule}
            updateLessonInModule={updateLessonInModule}
            removeLessonFromModule={removeLessonFromModule}
            moduleLoading={moduleLoading}
            moduleError={moduleError}
            setShowCreateForm={setShowCreateForm}
          />
        );

      case "drip":
        return <DripTabContent />;

      case "assets":
        return <AssetsTabContent courseID={courseId} />;

      default:
        return null;
    }
  };

  return (
    <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl shadow-xl p-8">
      <div className="mb-8">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-xl">
                <BookOpen className="w-8 h-8 text-blue-600" />
              </div>
              Course Content
            </h2>
            <p className="text-gray-600 mt-2">
              Build and manage your course content
            </p>
          </div>
          {activeTab === "modules" && !showCreateForm && (
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <Plus className="w-5 h-5" />
              Create Module
            </button>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 flex-1 justify-center ${
                    isActive
                      ? `bg-white shadow-sm text-${tab.color}-600 border border-${tab.color}-200`
                      : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                  {tab.id === "modules" && totalModules > 0 && (
                    <span
                      className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                        isActive
                          ? `bg-${tab.color}-100 text-${tab.color}-700`
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {totalModules}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="min-h-fit">
          {/* <div className="min-h-[400px]"> */}
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default ModuleSection;
