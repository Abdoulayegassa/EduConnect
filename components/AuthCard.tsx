// components/AuthCard.tsx
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="shadow-xl border-0">
      <CardHeader>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && (
          <p className="text-sm text-gray-600 mt-1">
            {subtitle}
          </p>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
