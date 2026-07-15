import { Navigate, Route, Routes } from 'react-router-dom';
import { CoursesListPage } from './pages/CoursesListPage';
import { AddCoursePage } from './pages/AddCoursePage';
import { BulkImportPage } from './pages/BulkImportPage';
import { LoginPage } from './pages/LoginPage';
import { RequireAuth } from './components/RequireAuth';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/courses" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/courses"
        element={
          <RequireAuth>
            <CoursesListPage />
          </RequireAuth>
        }
      />
      <Route
        path="/courses/new"
        element={
          <RequireAuth>
            <AddCoursePage />
          </RequireAuth>
        }
      />
      <Route
        path="/courses/import"
        element={
          <RequireAuth>
            <BulkImportPage />
          </RequireAuth>
        }
      />
      <Route
        path="/courses/:id"
        element={
          <RequireAuth>
            <AddCoursePage />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
