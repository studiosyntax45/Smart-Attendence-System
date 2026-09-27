import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { getMyInsight } from "@/lib/insights";
import { StudentInsightView } from "@/components/insights/student-insight-view";
import { SectionError } from "@/components/section-error";
import { PageTitle } from "@/src/page-title";

export default function StudentInsightsPage() {
  const { profile } = useAuth();
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["my-insight", profile?.id],
    enabled: !!profile,
    queryFn: getMyInsight,
  });

  if (isError) return <SectionError error={new Error("Could not load your insights.")} reset={() => refetch()} />;

  return (
    <div className="space-y-6">
      <PageTitle title="AI Insights" />
      <div>
        <h1 className="text-2xl font-bold">AI Insights</h1>
        <p className="text-sm text-muted-foreground">
          Where you stand in each subject, from your attendance and marks, and what to do next.
        </p>
      </div>
      <StudentInsightView insight={data} isLoading={!profile || isPending} />
    </div>
  );
}
