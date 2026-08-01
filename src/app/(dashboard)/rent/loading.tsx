import { Skeleton } from "@/components/ui/skeleton";

export default function RentLoading() {
  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
