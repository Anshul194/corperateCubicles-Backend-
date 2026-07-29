# How to Check Course Completion

Based on the project codebase, here are the ways to determine if a course is completed:

## 1. API Response (Frontend Usage)
When you fetch course progress (e.g., via `GET /progress/:courseId/progress`), the response includes a boolean key:

- **Key**: `isCompleted`
- **Type**: `Boolean`
- **Logic**: It is `true` if `courseCompletionPercentage >= 100`.

**Example Response:**
```json
{
  "success": true,
  "data": {
    "totalLessons": 10,
    "completedLessons": 10,
    "courseCompletionPercentage": 100,
    "isCompleted": true,  <-- CHECK THIS KEY
    "lessons": [...]
  }
}
```

## 2. Database (Backend/Direct DB Usage)
In the `CourseEnrollment` collection, there are two fields you can check:

- **Field**: `iscompleted`
  - **Type**: `Boolean`
  - **Default**: `false`

- **Field**: `status`
  - **Type**: `String`
  - **Value**: `'completed'`

## 3. Calculation Logic
The completion is calculated in `ProgressRepository.js` by comparing the number of completed lessons against the total number of lessons in the course.

```javascript
courseCompletionPercentage: (completedLessons / totalLessons) * 100
```
