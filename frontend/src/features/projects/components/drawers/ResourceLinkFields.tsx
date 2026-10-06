import { useId } from "react";
import { Field, TextInput } from "@/shared/components/Field";
import { MAX_LABEL_LENGTH } from "@/features/projects/models/project";

export function ResourceLinkFields({
  url,
  label,
  urlError,
  labelError,
  urlPlaceholder,
  onUrlChange,
  onLabelChange,
}: {
  url: string;
  label: string;
  urlError?: string;
  labelError?: string;
  urlPlaceholder: string;
  onUrlChange: (value: string) => void;
  onLabelChange: (value: string) => void;
}) {
  const urlId = useId();
  const labelId = useId();
  return (
    <>
      <Field
        label="Link (https://)"
        htmlFor={urlId}
        error={urlError}
        hint="Members open this link from their project page."
      >
        <TextInput
          id={urlId}
          type="url"
          inputMode="url"
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          placeholder={urlPlaceholder}
          aria-invalid={urlError ? true : undefined}
          autoComplete="off"
        />
      </Field>
      <Field label="Label (optional)" htmlFor={labelId} error={labelError}>
        <TextInput
          id={labelId}
          value={label}
          onChange={(event) => onLabelChange(event.target.value)}
          placeholder="Shown instead of the raw link"
          maxLength={MAX_LABEL_LENGTH + 20}
          autoComplete="off"
        />
      </Field>
    </>
  );
}
