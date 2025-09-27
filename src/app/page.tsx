"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Stage,
  Layer,
  Rect,
  Text as KonvaText,
  Image as KonvaImage,
} from "react-konva";
import useImage from "use-image";
import {
  fetchModels,
  triggerGeneration,
  requestPresignedUpload,
  processUploadedFile,
  fetchHistory,
  saveProject,
  fetchProject,
  fetchRealtimeToken,
  type UniteGenModel,
  type UniteGenModelParameter,
  type GenerateRequest,
  type GenerateResponse,
  type HistoryResponse,
} from "@/lib/unite-gen-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SpinnerIcon } from "@/components/icons";
import {
  TriggerAuthContext,
  useRealtimeRunsWithTag,
} from "@trigger.dev/react-hooks";
import { useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";

const STAGE_PADDING = 2000;

interface CanvasElement {
  id: string;
  type: "image" | "video";
  url: string;
  thumbnailUrl?: string | null;
  width: number;
  height: number;
  x: number;
  y: number;
}

interface JobState {
  jobId: string;
  runId: string;
  modelId: string;
  status: string;
  parameters: Record<string, unknown>;
  result?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  runStatus?: string;
}

type FormValues = Record<string, unknown>;

type UploadState = Record<string, "idle" | "uploading" | "uploaded" | "error">;

function useContainerSize<T extends HTMLElement>() {
  const [node, setNode] = useState<T | null>(null);
  const ref = useCallback((element: T | null) => {
    setNode(element);
  }, []);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect) {
          setSize({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        }
      }
    });

    observer.observe(node);
    setSize({ width: node.clientWidth, height: node.clientHeight });

    return () => observer.disconnect();
  }, [node]);

  return { ref, size } as const;
}

function useInitialProjectId() {
  const searchParams = useSearchParams();
  return searchParams.get("projectId");
}

function isTruthyValue(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && value !== "";
}

function resolveMediaType(parameter: UniteGenModelParameter, fileType: string) {
  if (parameter.accept?.includes("video") || fileType.startsWith("video/")) {
    return "video" as const;
  }
  if (parameter.accept?.includes("audio") || fileType.startsWith("audio/")) {
    return "audio" as const;
  }
  return "image" as const;
}

function evaluateConditional(
  parameter: UniteGenModelParameter,
  values: FormValues,
) {
  if (!parameter.conditional) return true;

  return Object.entries(parameter.conditional).every(([key, condition]) => {
    const value = values[key];
    if (
      condition &&
      typeof condition === "object" &&
      !Array.isArray(condition)
    ) {
      if ("$exists" in condition) {
        const shouldExist = Boolean(condition["$exists"]);
        const exists = isTruthyValue(value);
        return shouldExist ? exists : !exists;
      }
      if ("$size" in condition) {
        if (Array.isArray(value)) {
          return value.length === Number(condition["$size"]);
        }
        return false;
      }
      if ("$in" in condition && Array.isArray(condition["$in"])) {
        return condition["$in"].includes(value as never);
      }
      if ("$ne" in condition) {
        return value !== condition["$ne"];
      }
    }

    return value === condition;
  });
}

function normalizeOption(option: string | { label: string; value: string }) {
  if (typeof option === "string") {
    return { label: option, value: option };
  }
  return option;
}

function CanvasMedia({
  element,
  isSelected,
  onSelect,
  onDrag,
  onUpdateSize,
}: {
  element: CanvasElement;
  isSelected: boolean;
  onSelect: () => void;
  onDrag: (position: { x: number; y: number }) => void;
  onUpdateSize: (size: { width: number; height: number }) => void;
}) {
  const [image] = useImage(element.thumbnailUrl ?? element.url, "anonymous");

  useEffect(() => {
    if (image && (!element.width || !element.height)) {
      onUpdateSize({ width: image.width, height: image.height });
    }
  }, [image, element.width, element.height, onUpdateSize]);

  if (!image) {
    return (
      <Rect
        x={element.x}
        y={element.y}
        width={element.width || 256}
        height={element.height || 256}
        fill={isSelected ? "rgba(59,130,246,0.35)" : "rgba(148,163,184,0.2)"}
        stroke={isSelected ? "#3b82f6" : undefined}
        strokeWidth={isSelected ? 2 : 0}
        cornerRadius={12}
        onClick={onSelect}
        onTap={onSelect}
        draggable
        onDragEnd={(event) => {
          onDrag({ x: event.target.x(), y: event.target.y() });
        }}
      />
    );
  }

  return (
    <KonvaImage
      image={image}
      x={element.x}
      y={element.y}
      width={element.width || image.width}
      height={element.height || image.height}
      listening
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(event) => {
        onDrag({ x: event.target.x(), y: event.target.y() });
      }}
      opacity={isSelected ? 0.85 : 1}
      shadowBlur={isSelected ? 10 : 0}
      shadowColor={isSelected ? "#2563eb" : undefined}
    />
  );
}

export default function CanvasPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formValues, setFormValues] = useState<FormValues>({});
  const [uploadState, setUploadState] = useState<UploadState>({});
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    null,
  );
  const [stageScale, setStageScale] = useState(1);
  const [stagePosition, setStagePosition] = useState({ x: 0, y: 0 });
  const [projectTitle, setProjectTitle] = useState("Untitled Canvas");
  const [projectMeta, setProjectMeta] = useState<{
    id?: string;
    revision?: number;
  }>();
  const [activeJobs, setActiveJobs] = useState<Record<string, JobState>>({});
  const [isSaving, setIsSaving] = useState(false);
  const processedJobIds = useRef(new Set<string>());
  const fetchedRunDetails = useRef(new Set<string>());
  const realtimeErrorShown = useRef(false);

  const { ref: stageContainerRef, size: stageSize } =
    useContainerSize<HTMLDivElement>();
  const initialProjectId = useInitialProjectId();

  const modelsQuery = useQuery({
    queryKey: ["unite-gen", "models"],
    queryFn: fetchModels,
    staleTime: 5 * 60 * 1000,
  });

  const historyQuery = useQuery<HistoryResponse>({
    queryKey: ["unite-gen", "history"],
    queryFn: () => fetchHistory({ limit: 25 }),
    refetchInterval: 30_000,
  });

  const realtimeTokenQuery = useQuery({
    queryKey: ["unite-gen", "realtime-token"],
    queryFn: fetchRealtimeToken,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const realtimeTag = realtimeTokenQuery.data?.tags?.find((tag) =>
    tag.startsWith("user_"),
  );

  useEffect(() => {
    if (realtimeTokenQuery.error && !realtimeErrorShown.current) {
      toast({
        title: "Realtime unavailable",
        description:
          "Unable to subscribe to live updates. Falling back to polling.",
      });
      realtimeErrorShown.current = true;
    }
  }, [realtimeTokenQuery.error, toast]);

  const generationMutation = useMutation<
    GenerateResponse,
    Error,
    GenerateRequest
  >({
    mutationFn: triggerGeneration,
    onSuccess: (data) => {
      const job = data.job;
      setActiveJobs((prev) => ({
        ...prev,
        [job.runId]: {
          jobId: job.id,
          runId: job.runId,
          modelId: job.modelId,
          status: job.status,
          parameters: job.parameters,
          result: (job.result as Record<string, unknown>) ?? null,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
        },
      }));
      toast({
        title: "Generation queued",
        description: "Tracking progress in real time.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to start generation",
        description: error?.message ?? "Unknown error",
        variant: "destructive",
      });
    },
  });

  const saveProjectMutation = useMutation({
    mutationFn: saveProject,
    onMutate: () => {
      setIsSaving(true);
    },
    onSuccess: (data) => {
      setProjectMeta({ id: data.id, revision: data.revision });
      toast({
        title: "Canvas saved",
        description: `Revision ${data.revision} stored successfully.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save canvas",
        description: error?.message ?? "Unknown error",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsSaving(false);
    },
  });

  const fetchJobStatusAndHistory = useCallback(
    async (runId: string) => {
      try {
        await queryClient.invalidateQueries({
          queryKey: ["unite-gen", "history"],
        });
      } catch (error) {
        console.error("Failed to refresh history", error);
      }
    },
    [queryClient],
  );

  const handleRunUpdate = useCallback(
    (run: any) => {
      setActiveJobs((prev) => {
        const existing = prev[run.id];
        if (!existing) {
          const createdAt =
            typeof run.createdAt?.toISOString === "function"
              ? run.createdAt.toISOString()
              : new Date().toISOString();
          const updatedAt =
            typeof run.updatedAt?.toISOString === "function"
              ? run.updatedAt.toISOString()
              : createdAt;
          return {
            ...prev,
            [run.id]: {
              jobId: run.id,
              runId: run.id,
              modelId: run.taskIdentifier ?? "unknown",
              status: run.status,
              parameters: {},
              result: null,
              createdAt,
              updatedAt,
              runStatus: run.status,
            },
          };
        }
        return {
          ...prev,
          [run.id]: {
            ...existing,
            runStatus: run.status,
            updatedAt:
              typeof run.updatedAt?.toISOString === "function"
                ? run.updatedAt.toISOString()
                : existing.updatedAt,
          },
        };
      });

      if (run.isCompleted || run.isFailed || run.isCancelled) {
        if (!fetchedRunDetails.current.has(run.id)) {
          fetchedRunDetails.current.add(run.id);
          fetchJobStatusAndHistory(run.id);
        }
      }
    },
    [fetchJobStatusAndHistory],
  );

  const selectedModel = useMemo<UniteGenModel | null>(() => {
    if (!modelsQuery.data?.models) return null;
    if (selectedModelId) {
      return (
        modelsQuery.data.models.find((model) => model.id === selectedModelId) ??
        null
      );
    }
    return modelsQuery.data.models.length > 0
      ? modelsQuery.data.models[0]
      : null;
  }, [modelsQuery.data?.models, selectedModelId]);

  useEffect(() => {
    if (!selectedModel || !selectedModel.parameters) return;
    const defaults: FormValues = {};
    for (const parameter of selectedModel.parameters) {
      if (parameter.type === "computed") continue;
      if (parameter.default !== undefined) {
        defaults[parameter.name] = parameter.default;
      } else if (parameter.type === "boolean") {
        defaults[parameter.name] = false;
      }
    }
    setFormValues(defaults);
    setUploadState({});
  }, [selectedModel]);

  useEffect(() => {
    if (!initialProjectId) return;
    fetchProject(initialProjectId)
      .then((project) => {
        const payload = project.serializedJson as {
          elements?: CanvasElement[];
          stageScale?: number;
          stagePosition?: { x: number; y: number };
        };
        if (payload.elements) setElements(payload.elements);
        if (payload.stageScale) setStageScale(payload.stageScale);
        if (payload.stagePosition) setStagePosition(payload.stagePosition);
        setProjectTitle(project.title);
        setProjectMeta({ id: project.id, revision: project.revision });
      })
      .catch((error) => {
        toast({
          title: "Failed to load project",
          description: error?.message ?? "Unknown error",
          variant: "destructive",
        });
      });
  }, [initialProjectId, toast]);

  useEffect(() => {
    const stored = localStorage.getItem("infinite-canvas-state");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as {
          elements?: CanvasElement[];
          stageScale?: number;
          stagePosition?: { x: number; y: number };
          projectTitle?: string;
        };
        if (parsed.elements) setElements(parsed.elements);
        if (parsed.stageScale) setStageScale(parsed.stageScale);
        if (parsed.stagePosition) setStagePosition(parsed.stagePosition);
        if (parsed.projectTitle) setProjectTitle(parsed.projectTitle);
      } catch (error) {
        console.error("Failed to parse local canvas state", error);
      }
    }
  }, []);

  useEffect(() => {
    const payload = {
      elements,
      stageScale,
      stagePosition,
      projectTitle,
    };
    localStorage.setItem("infinite-canvas-state", JSON.stringify(payload));
  }, [elements, stageScale, stagePosition, projectTitle]);

  const addResultToCanvas = useCallback(
    (jobId: string, result: Record<string, unknown>) => {
      const results: CanvasElement[] = [];
      if (result) {
        if (result.type === "image" && typeof result.url === "string") {
          results.push({
            id: `${jobId}-image`,
            type: "image",
            url: result.url as string,
            thumbnailUrl: (result.thumbnailUrl as string | undefined) ?? null,
            width: Number(result.metadata?.width ?? 512),
            height: Number(result.metadata?.height ?? 512),
            x: Math.random() * 400 - 200,
            y: Math.random() * 400 - 200,
          });
        }
        if (result.type === "video" && typeof result.url === "string") {
          results.push({
            id: `${jobId}-video`,
            type: "video",
            url: result.url as string,
            thumbnailUrl: (result.thumbnailUrl as string | undefined) ?? null,
            width: Number(result.metadata?.width ?? 512),
            height: Number(result.metadata?.height ?? 288),
            x: Math.random() * 400 - 200,
            y: Math.random() * 400 - 200,
          });
        }
        if (Array.isArray(result.outputs)) {
          for (const [index, item] of result.outputs.entries()) {
            if (item?.type === "image" && typeof item.url === "string") {
              results.push({
                id: `${jobId}-image-${index}`,
                type: "image",
                url: item.url,
                thumbnailUrl: item.thumbnailUrl ?? null,
                width: Number(item.metadata?.width ?? 512),
                height: Number(item.metadata?.height ?? 512),
                x: Math.random() * 400 - 200,
                y: Math.random() * 400 - 200,
              });
            }
          }
        }
      }

      if (results.length === 0) {
        toast({
          title: "Generation completed",
          description: "Result available in history but could not be parsed.",
        });
        return;
      }

      setElements((prev) => [...prev, ...results]);
      toast({
        title: "Generation completed",
        description: `${results.length} asset${results.length > 1 ? "s" : ""} added to canvas`,
      });
    },
    [toast],
  );

  useEffect(() => {
    const jobs = historyQuery.data?.jobs ?? [];
    const terminalStatuses = new Set([
      "completed",
      "failed",
      "errored",
      "canceled",
      "cancelled",
    ]);

    for (const job of jobs) {
      if (terminalStatuses.has(job.status) && job.runId) {
        setActiveJobs((prev) => {
          const next = { ...prev };
          delete next[job.runId!];
          return next;
        });
      }

      if (job.status !== "completed") continue;
      if (processedJobIds.current.has(job.id)) continue;
      processedJobIds.current.add(job.id);
      if (job.result) {
        addResultToCanvas(job.id, job.result as Record<string, unknown>);
      }
    }
  }, [addResultToCanvas, historyQuery.data]);

  const handleParameterChange = useCallback((name: string, value: unknown) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleFileUpload = useCallback(
    async (parameter: UniteGenModelParameter, files: FileList | null) => {
      if (!files || files.length === 0) return;
      const fileArray = Array.from(files);

      if (parameter.type === "multifile") {
        const uploadedUrls: string[] = [];
        setUploadState((prev) => ({ ...prev, [parameter.name]: "uploading" }));
        try {
          for (const file of fileArray) {
            const mediaType = resolveMediaType(parameter, file.type);
            const presigned = await requestPresignedUpload({
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              mediaType,
            });
            const uploadResponse = await fetch(presigned.presignedUrl, {
              method: "PUT",
              body: file,
              headers: {
                "Content-Type": file.type,
              },
            });
            if (!uploadResponse.ok) {
              throw new Error(
                `Upload failed with status ${uploadResponse.status}`,
              );
            }
            uploadedUrls.push(presigned.uploadUrl);
            await processUploadedFile({
              fileKey: presigned.fileKey,
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              mediaType,
              uploadUrl: presigned.uploadUrl,
              purpose: "generation_input",
            }).catch(() => undefined);
          }
          handleParameterChange(parameter.name, uploadedUrls);
          setUploadState((prev) => ({ ...prev, [parameter.name]: "uploaded" }));
          toast({ title: "Files uploaded" });
        } catch (error: any) {
          console.error(error);
          setUploadState((prev) => ({ ...prev, [parameter.name]: "error" }));
          toast({
            title: "Upload failed",
            description: error?.message ?? "Unknown error",
            variant: "destructive",
          });
        }
        return;
      }

      const file = fileArray[0];
      setUploadState((prev) => ({ ...prev, [parameter.name]: "uploading" }));
      try {
        const mediaType = resolveMediaType(parameter, file.type);
        const presigned = await requestPresignedUpload({
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          mediaType,
        });
        const uploadResponse = await fetch(presigned.presignedUrl, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type,
          },
        });
        if (!uploadResponse.ok) {
          throw new Error(`Upload failed with status ${uploadResponse.status}`);
        }
        await processUploadedFile({
          fileKey: presigned.fileKey,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          mediaType,
          uploadUrl: presigned.uploadUrl,
          purpose: "generation_input",
        }).catch(() => undefined);

        handleParameterChange(parameter.name, presigned.uploadUrl);
        setUploadState((prev) => ({ ...prev, [parameter.name]: "uploaded" }));
        toast({ title: "File uploaded" });
      } catch (error: any) {
        console.error(error);
        setUploadState((prev) => ({ ...prev, [parameter.name]: "error" }));
        toast({
          title: "Upload failed",
          description: error?.message ?? "Unknown error",
          variant: "destructive",
        });
      }
    },
    [handleParameterChange, toast],
  );

  const handleGenerate = useCallback(() => {
    if (!selectedModel) {
      toast({
        title: "No model selected",
        description: "Choose a model before generating.",
        variant: "destructive",
      });
      return;
    }

    const parameters: Record<string, unknown> = {};
    for (const parameter of selectedModel.parameters) {
      if (parameter.type === "computed") continue;
      const shouldRender =
        parameter.type === "hidden"
          ? true
          : evaluateConditional(parameter, formValues);
      if (!shouldRender) continue;
      const value = formValues[parameter.name];
      if (parameter.required && !isTruthyValue(value)) {
        toast({
          title: "Missing parameter",
          description: `Provide a value for ${parameter.name}.`,
          variant: "destructive",
        });
        return;
      }
      if (
        value !== undefined &&
        (parameter.type === "boolean" ||
          parameter.type === "hidden" ||
          isTruthyValue(value))
      ) {
        parameters[parameter.name] = value;
      }
    }

    generationMutation.mutate({
      modelId: selectedModel.id,
      parameters,
    });
  }, [formValues, generationMutation, selectedModel, toast]);

  const handleSaveProject = useCallback(() => {
    const payload = {
      id: projectMeta?.id,
      title: projectTitle,
      serializedJson: {
        elements,
        stageScale,
        stagePosition,
      },
      revision: projectMeta?.revision,
      isDraft: false,
    };
    saveProjectMutation.mutate(payload);
  }, [
    elements,
    projectMeta?.id,
    projectMeta?.revision,
    projectTitle,
    saveProjectMutation,
    stagePosition,
    stageScale,
  ]);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedElementId) return;
    setElements((prev) =>
      prev.filter((element) => element.id !== selectedElementId),
    );
    setSelectedElementId(null);
  }, [selectedElementId]);

  const zoom = useCallback((delta: number) => {
    setStageScale((prev) => Math.min(3, Math.max(0.2, prev + delta)));
  }, []);

  const renderedParameters = useMemo(() => {
    if (!selectedModel) return null;
    return selectedModel.parameters
      .filter((parameter) => parameter.type !== "computed")
      .map((parameter) => {
        const visible =
          parameter.type === "hidden" ||
          evaluateConditional(parameter, formValues);
        if (!visible) return null;
        const value = formValues[parameter.name];
        const state = uploadState[parameter.name] ?? "idle";
        switch (parameter.type) {
          case "text":
            return (
              <div className="space-y-2" key={parameter.name}>
                <Label>{parameter.name}</Label>
                <Input
                  value={typeof value === "string" ? value : ""}
                  onChange={(event) =>
                    handleParameterChange(parameter.name, event.target.value)
                  }
                  placeholder={
                    parameter.uiPriority === "primary" ? "Prompt" : undefined
                  }
                />
              </div>
            );
          case "textarea":
            return (
              <div className="space-y-2" key={parameter.name}>
                <Label>{parameter.name}</Label>
                <Textarea
                  value={typeof value === "string" ? value : ""}
                  onChange={(event) =>
                    handleParameterChange(parameter.name, event.target.value)
                  }
                  rows={4}
                />
              </div>
            );
          case "number":
          case "slider":
            return (
              <div className="space-y-2" key={parameter.name}>
                <Label>{parameter.name}</Label>
                <Input
                  type="number"
                  value={
                    typeof value === "number" ? value : (parameter.default ?? 0)
                  }
                  onChange={(event) =>
                    handleParameterChange(
                      parameter.name,
                      Number(event.target.value) || 0,
                    )
                  }
                />
              </div>
            );
          case "select":
          case "radio": {
            const options = (parameter.options ?? []).map(normalizeOption);
            return (
              <div className="space-y-2" key={parameter.name}>
                <Label>{parameter.name}</Label>
                <Select
                  value={typeof value === "string" ? value : undefined}
                  onValueChange={(next) =>
                    handleParameterChange(parameter.name, next)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select option" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((option) => (
                      <SelectItem value={option.value} key={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          }
          case "boolean":
            return (
              <div
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                key={parameter.name}
              >
                <div>
                  <Label>{parameter.name}</Label>
                </div>
                <Switch
                  checked={Boolean(value)}
                  onCheckedChange={(checked) =>
                    handleParameterChange(parameter.name, checked)
                  }
                />
              </div>
            );
          case "file":
          case "multifile":
            return (
              <div className="space-y-2" key={parameter.name}>
                <Label>{parameter.name}</Label>
                <Input
                  type="file"
                  multiple={parameter.type === "multifile"}
                  accept={parameter.accept}
                  onChange={(event) =>
                    handleFileUpload(parameter, event.target.files)
                  }
                />
                {state === "uploading" && (
                  <p className="text-sm text-muted-foreground">Uploading...</p>
                )}
                {state === "uploaded" && (
                  <p className="text-sm text-emerald-500">Upload complete</p>
                )}
                {state === "error" && (
                  <p className="text-sm text-destructive">Upload failed</p>
                )}
              </div>
            );
          case "hidden":
            return null;
          default:
            return (
              <div className="space-y-2" key={parameter.name}>
                <Label>{parameter.name}</Label>
                <Input
                  value={typeof value === "string" ? value : ""}
                  onChange={(event) =>
                    handleParameterChange(parameter.name, event.target.value)
                  }
                />
              </div>
            );
        }
      });
  }, [
    formValues,
    handleFileUpload,
    handleParameterChange,
    selectedModel,
    uploadState,
  ]);

  return (
    <div className="flex h-screen flex-col gap-4 bg-background p-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Infinite Canvas</h1>
          <Input
            className="w-64"
            value={projectTitle}
            onChange={(event) => setProjectTitle(event.target.value)}
          />
          <Button
            variant="outline"
            onClick={handleSaveProject}
            disabled={isSaving}
          >
            {isSaving && <SpinnerIcon className="mr-2 h-4 w-4 animate-spin" />}
            Save snapshot
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => zoom(0.1)}>
            Zoom in
          </Button>
          <Button variant="outline" onClick={() => zoom(-0.1)}>
            Zoom out
          </Button>
          <Button
            variant="destructive"
            onClick={handleDeleteSelected}
            disabled={!selectedElementId}
          >
            Delete selected
          </Button>
        </div>
      </header>
      <main className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[320px_1fr_320px]">
        <section className="flex flex-col gap-4">
          <Card className="h-full overflow-y-auto">
            <CardHeader>
              <CardTitle>Models</CardTitle>
              <CardDescription>
                Configure parameters dynamically from Unite Gen.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {modelsQuery.isLoading && (
                <p className="text-sm text-muted-foreground">
                  Loading models...
                </p>
              )}
              {modelsQuery.error && (
                <p className="text-sm text-destructive">
                  Failed to load models
                </p>
              )}
              {modelsQuery.data?.models &&
                modelsQuery.data.models.length > 0 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Model</Label>
                      <Select
                        value={selectedModel?.id ?? undefined}
                        onValueChange={(value) => setSelectedModelId(value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a model" />
                        </SelectTrigger>
                        <SelectContent>
                          {modelsQuery.data.models
                            .filter((model) => model.visible)
                            .map((model) => (
                              <SelectItem value={model.id} key={model.id}>
                                {model.id}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {renderedParameters}
                    <Button
                      className="w-full"
                      onClick={handleGenerate}
                      disabled={generationMutation.isPending}
                    >
                      {generationMutation.isPending && (
                        <SpinnerIcon className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Generate
                    </Button>
                  </div>
                )}
            </CardContent>
          </Card>
        </section>
        <section className="relative flex h-full min-h-[60vh] flex-col overflow-hidden rounded-lg border">
          <div
            ref={stageContainerRef}
            className="relative h-full w-full flex-1 bg-muted"
          >
            <Stage
              width={stageSize.width || 800}
              height={stageSize.height || 600}
              scaleX={stageScale}
              scaleY={stageScale}
              x={stagePosition.x}
              y={stagePosition.y}
              draggable
              onDragEnd={(event) => {
                setStagePosition({ x: event.target.x(), y: event.target.y() });
              }}
              onWheel={(event) => {
                event.evt.preventDefault();
                const scaleBy = 1.05;
                const stage = event.target.getStage();
                if (!stage) return;
                const oldScale = stageScale;
                const pointer = stage.getPointerPosition();
                if (!pointer) return;
                const mousePointTo = {
                  x: (pointer.x - stage.x()) / oldScale,
                  y: (pointer.y - stage.y()) / oldScale,
                };
                const direction = event.evt.deltaY > 0 ? -1 : 1;
                const newScale = Math.min(
                  3,
                  Math.max(
                    0.2,
                    oldScale * (direction > 0 ? scaleBy : 1 / scaleBy),
                  ),
                );
                setStageScale(newScale);
                const newPos = {
                  x: pointer.x - mousePointTo.x * newScale,
                  y: pointer.y - mousePointTo.y * newScale,
                };
                setStagePosition(newPos);
              }}
            >
              <Layer>
                <Rect
                  x={-STAGE_PADDING}
                  y={-STAGE_PADDING}
                  width={(stageSize.width || 800) + STAGE_PADDING * 2}
                  height={(stageSize.height || 600) + STAGE_PADDING * 2}
                  fill="#0f172a"
                />
                {elements.map((element) => (
                  <CanvasMedia
                    key={element.id}
                    element={element}
                    isSelected={selectedElementId === element.id}
                    onSelect={() => setSelectedElementId(element.id)}
                    onDrag={(position) =>
                      setElements((prev) =>
                        prev.map((item) =>
                          item.id === element.id
                            ? { ...item, x: position.x, y: position.y }
                            : item,
                        ),
                      )
                    }
                    onUpdateSize={(size) =>
                      setElements((prev) =>
                        prev.map((item) =>
                          item.id === element.id
                            ? {
                                ...item,
                                width: size.width,
                                height: size.height,
                              }
                            : item,
                        ),
                      )
                    }
                  />
                ))}
                {elements.length === 0 && (
                  <KonvaText
                    text="Generate assets to populate your canvas"
                    fontSize={24}
                    x={(stageSize.width || 800) / 2 - 200}
                    y={(stageSize.height || 600) / 2 - 20}
                    fill="#cbd5f5"
                  />
                )}
              </Layer>
            </Stage>
          </div>
        </section>
        <section className="flex flex-col gap-4">
          <Card className="h-full overflow-y-auto">
            <CardHeader>
              <CardTitle>Activity</CardTitle>
              <CardDescription>
                Track realtime progress and completed results.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-sm font-medium uppercase text-muted-foreground">
                  Active runs
                </h3>
                <div className="space-y-3">
                  {Object.values(activeJobs).length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No active jobs.
                    </p>
                  )}
                  {Object.values(activeJobs).map((job) => (
                    <div
                      key={job.runId}
                      className="rounded-md border border-border p-3"
                    >
                      <p className="text-sm font-medium">{job.modelId}</p>
                      <p className="text-xs text-muted-foreground">
                        Run ID: {job.runId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Status: {job.runStatus ?? job.status}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-medium uppercase text-muted-foreground">
                  History
                </h3>
                <div className="space-y-3">
                  {historyQuery.isLoading && (
                    <p className="text-sm text-muted-foreground">
                      Loading history...
                    </p>
                  )}
                  {historyQuery.error && (
                    <p className="text-sm text-destructive">
                      Failed to load history
                    </p>
                  )}
                  {historyQuery.data?.jobs?.map((job) => {
                    const jobResult = job.result as
                      | { type?: string; url?: string; thumbnailUrl?: string }
                      | null
                      | undefined;
                    return (
                      <div
                        key={job.id}
                        className="rounded-md border border-border p-3"
                      >
                        <p className="text-sm font-medium">{job.modelId}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {job.status}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Updated{" "}
                          {formatDistanceToNow(new Date(job.updatedAt), {
                            addSuffix: true,
                          })}
                        </p>
                        {jobResult?.type === "video" &&
                          jobResult.thumbnailUrl &&
                          jobResult.url && (
                            <video
                              src={jobResult.url}
                              poster={jobResult.thumbnailUrl}
                              controls
                              className="mt-2 h-32 w-full rounded-md object-cover"
                            />
                          )}
                        {jobResult?.type === "image" && jobResult.url && (
                          <img
                            src={jobResult.url}
                            alt="Generated result"
                            className="mt-2 h-32 w-full rounded-md object-cover"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
      {realtimeTokenQuery.data?.token && realtimeTag ? (
        <TriggerAuthContext.Provider
          value={{ accessToken: realtimeTokenQuery.data.token }}
        >
          <RealtimeRunsListener
            tag={realtimeTag}
            onRunUpdate={handleRunUpdate}
          />
        </TriggerAuthContext.Provider>
      ) : null}
    </div>
  );
}

function RealtimeRunsListener({
  tag,
  onRunUpdate,
}: {
  tag: string;
  onRunUpdate: (run: any) => void;
}) {
  const { runs } = useRealtimeRunsWithTag(tag, { enabled: true });

  useEffect(() => {
    if (!runs) return;
    for (const run of runs) {
      onRunUpdate(run);
    }
  }, [runs, onRunUpdate]);

  return null;
}
