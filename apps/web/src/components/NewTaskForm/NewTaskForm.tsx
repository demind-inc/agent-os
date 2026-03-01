"use client";

import "./NewTaskForm.scss";

type NewTaskFormProps = {
  title: string;
  description: string;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
};

export function NewTaskForm({
  title,
  description,
  onTitleChange,
  onDescriptionChange,
  onSubmit
}: NewTaskFormProps) {
  return (
    <form id="new-task" className="card column newTaskForm" onSubmit={onSubmit}>
      <strong className="newTaskForm__title">Create task</strong>
      <input
        className="newTaskForm__field"
        required
        placeholder="Task title"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
      />
      <textarea
        className="newTaskForm__field newTaskForm__textarea"
        placeholder="Task description (supports skill detection)"
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
      />
      <button type="submit" className="newTaskForm__submit">
        Create task
      </button>
    </form>
  );
}
