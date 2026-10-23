"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Clock,
  Loader2,
  Plus,
  Trash2,
  type LucideIcon,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatDate, getInitials, getJSON, sendJSON } from "@/lib/medicare-api";
import { HealthArticle } from "@/lib/medicare-types";

/* ------------------------------ local helpers ----------------------------- */

/** Sentinel for the "All categories" filter (Radix SelectItem forbids value=""). */
const CATEGORY_ALL = "all";

interface ArticleFormState {
  title: string;
  category: string;
  author: string;
  readTime: string;
  summary: string;
  content: string;
}

interface ArticleCreateBody {
  title: string;
  category: string;
  summary: string;
  content: string;
  author: string;
  readTime: number;
}

function emptyArticleForm(): ArticleFormState {
  return {
    title: "",
    category: "",
    author: "",
    readTime: "5",
    summary: "",
    content: "",
  };
}

function Field({
  label,
  required,
  htmlFor,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`min-w-0 space-y-1.5 ${className ?? ""}`}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}

function EmptyState({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <Badge variant="outline" className="border-transparent bg-primary/10 text-primary">
      {category}
    </Badge>
  );
}

function ReadTimeLabel({ minutes }: { minutes: number }) {
  return (
    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
      {minutes} min read
    </span>
  );
}

/* ------------------------------- the view --------------------------------- */

export default function ArticlesView() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [categoryFilter, setCategoryFilter] = useState<string>(CATEGORY_ALL);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ArticleFormState>(emptyArticleForm);
  const [reading, setReading] = useState<HealthArticle | null>(null);
  const [deleting, setDeleting] = useState<HealthArticle | null>(null);

  /* ------------------------------ data fetching ----------------------------- */

  const articlesQuery = useQuery({
    queryKey: ["articles", categoryFilter],
    queryFn: () => {
      const qs =
        categoryFilter !== CATEGORY_ALL ? `?category=${encodeURIComponent(categoryFilter)}` : "";
      return getJSON<{ data: HealthArticle[] }>(`/api/articles${qs}`);
    },
  });

  const articles = articlesQuery.data?.data ?? [];

  /* Unique categories derived from the loaded list (always keeps the active
     selection selectable even while the list is filtered). */
  const categories = useMemo(
    () => Array.from(new Set(articles.map((article) => article.category))).sort((a, b) => a.localeCompare(b)),
    [articles]
  );
  const categoryOptions = useMemo(
    () =>
      categoryFilter !== CATEGORY_ALL && !categories.includes(categoryFilter)
        ? [categoryFilter, ...categories]
        : categories,
    [categories, categoryFilter]
  );

  /* -------------------------------- mutations ------------------------------- */

  const invalidateAfterChange = () => {
    queryClient.invalidateQueries({ queryKey: ["articles"] });
    queryClient.invalidateQueries({ queryKey: ["stats"] });
  };

  const createMutation = useMutation({
    mutationFn: (body: ArticleCreateBody) =>
      sendJSON<{ data: HealthArticle }>("/api/articles", "POST", body),
    onSuccess: () => {
      toast({
        title: "Article published",
        description: "The health article is now available to readers.",
      });
      setFormOpen(false);
      setForm(emptyArticleForm());
      invalidateAfterChange();
    },
    onError: (error: Error) =>
      toast({
        title: "Could not publish article",
        description: error.message,
        variant: "destructive",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sendJSON<{ success: boolean }>(`/api/articles/${id}`, "DELETE"),
    onSuccess: () => {
      toast({ title: "Article deleted", description: "The article was removed." });
      setDeleting(null);
      invalidateAfterChange();
    },
    onError: (error: Error) =>
      toast({
        title: "Could not delete article",
        description: error.message,
        variant: "destructive",
      }),
  });

  /* --------------------------------- actions -------------------------------- */

  const openCreate = () => {
    setForm(emptyArticleForm());
    setFormOpen(true);
  };

  const handleCreate = () => {
    if (!form.title.trim() || !form.category.trim() || !form.author.trim() || !form.summary.trim() || !form.content.trim()) {
      toast({
        title: "Missing information",
        description: "Please fill in the title, category, author, summary and content.",
        variant: "destructive",
      });
      return;
    }
    const parsedReadTime = Number(form.readTime);
    const readTime =
      Number.isFinite(parsedReadTime) && parsedReadTime >= 1 ? Math.round(parsedReadTime) : 5;
    createMutation.mutate({
      title: form.title.trim(),
      category: form.category.trim(),
      author: form.author.trim(),
      summary: form.summary.trim(),
      content: form.content.trim(),
      readTime,
    });
  };

  const isLoading = articlesQuery.isLoading;
  const isFiltered = categoryFilter !== CATEGORY_ALL;

  /* ---------------------------------- render -------------------------------- */

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-52" aria-label="Filter by category">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={CATEGORY_ALL}>All categories</SelectItem>
            {categoryOptions.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Write Article
        </Button>
      </div>

      {/* Error state */}
      {articlesQuery.isError && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm font-medium text-destructive">Failed to load articles</p>
            <p className="max-w-md text-sm text-muted-foreground">
              {(articlesQuery.error as Error).message}
            </p>
            <Button variant="outline" size="sm" onClick={() => articlesQuery.refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {isLoading && !articlesQuery.isError && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="flex flex-col p-6">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="mt-3 h-5 w-full" />
              <Skeleton className="mt-1.5 h-5 w-3/4" />
              <div className="mt-2 space-y-1.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <div className="mt-4 flex items-center justify-between border-t pt-4">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-7 w-7 rounded-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-8 w-20" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !articlesQuery.isError && articles.length === 0 && (
        <EmptyState
          icon={BookOpen}
          title="No articles yet"
          hint={
            isFiltered
              ? "No articles in this category yet — try another one."
              : "Write your first health article to share knowledge with patients."
          }
        />
      )}

      {/* Data */}
      {!isLoading && !articlesQuery.isError && articles.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {articles.map((article) => (
            <Card key={article.id} className="flex flex-col p-6">
              <div className="flex items-center justify-between gap-2">
                <CategoryBadge category={article.category} />
                <ReadTimeLabel minutes={article.readTime} />
              </div>

              <h3 className="mt-3 font-semibold leading-snug line-clamp-2">{article.title}</h3>
              <p className="mt-2 flex-1 text-sm text-muted-foreground line-clamp-3">
                {article.summary}
              </p>

              <div className="mt-4 flex items-center justify-between gap-2 border-t pt-4">
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary/10 text-[10px] font-medium text-primary">
                      {getInitials(article.author)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate text-xs text-muted-foreground">{article.author}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    aria-label={`Read ${article.title}`}
                    onClick={() => setReading(article)}
                  >
                    Read more
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Delete ${article.title}`}
                    onClick={() => setDeleting(article)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Read dialog */}
      <Dialog
        open={!!reading}
        onOpenChange={(open) => {
          if (!open) setReading(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <div className="max-h-[75vh] overflow-y-auto scrollbar-thin pr-1">
            {reading && (
              <>
                <DialogHeader className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 pr-6">
                    <CategoryBadge category={reading.category} />
                    <ReadTimeLabel minutes={reading.readTime} />
                  </div>
                  <DialogTitle className="pr-6 text-left text-xl font-bold leading-snug">
                    {reading.title}
                  </DialogTitle>
                  <DialogDescription className="flex flex-wrap items-center gap-2 text-left">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="bg-primary/10 text-[10px] font-medium text-primary">
                        {getInitials(reading.author)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium text-foreground">{reading.author}</span>
                    <span className="text-xs text-muted-foreground">
                      · Published {formatDate(reading.createdAt)}
                    </span>
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-4 space-y-4">
                  <p className="border-l-2 border-primary/30 pl-3 text-sm italic text-muted-foreground">
                    {reading.summary}
                  </p>
                  <div className="whitespace-pre-line text-sm leading-relaxed">
                    {reading.content}
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Write article dialog */}
      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) setFormOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleCreate();
            }}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>New Health Article</DialogTitle>
              <DialogDescription>
                Share practical health knowledge with patients and visitors.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" required htmlFor="article-title" className="sm:col-span-2">
                <Input
                  id="article-title"
                  required
                  placeholder="e.g. 10 Habits for a Healthy Heart"
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                />
              </Field>

              <Field label="Category" required htmlFor="article-category">
                <Input
                  id="article-category"
                  required
                  placeholder="e.g. Cardiology"
                  value={form.category}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, category: event.target.value }))
                  }
                />
              </Field>

              <Field label="Author" required htmlFor="article-author">
                <Input
                  id="article-author"
                  required
                  placeholder="e.g. Dr. Sarah Mitchell"
                  value={form.author}
                  onChange={(event) => setForm((prev) => ({ ...prev, author: event.target.value }))}
                />
              </Field>

              <Field label="Read Time (minutes)" htmlFor="article-read-time">
                <Input
                  id="article-read-time"
                  type="number"
                  min={1}
                  step={1}
                  value={form.readTime}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, readTime: event.target.value }))
                  }
                />
              </Field>

              <Field label="Summary" required htmlFor="article-summary" className="sm:col-span-2">
                <Textarea
                  id="article-summary"
                  rows={2}
                  required
                  placeholder="One or two sentences shown in article listings…"
                  value={form.summary}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, summary: event.target.value }))
                  }
                />
              </Field>

              <Field label="Content" required htmlFor="article-content" className="sm:col-span-2">
                <Textarea
                  id="article-content"
                  rows={7}
                  required
                  className="min-h-[160px]"
                  placeholder={
                    "Write the article body here.\n\nLeave a blank line between paragraphs for readable spacing."
                  }
                  value={form.content}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, content: event.target.value }))
                  }
                />
              </Field>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                )}
                Publish Article
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this article?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `"${deleting.title}" will be permanently removed. This cannot be undone.`
                : "This article will be permanently removed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (deleting) deleteMutation.mutate(deleting.id);
              }}
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
