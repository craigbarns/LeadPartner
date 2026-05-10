import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Seat {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
}

interface SeatsListProps {
  seats: Seat[];
  includedSeats: number;
  extraSeatPrice: number;
}

export function SeatsList({ seats, includedSeats, extraSeatPrice }: SeatsListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Sièges payants ({seats.length} / {includedSeats} inclus)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {seats.map((seat, idx) => {
            const isExtra = idx >= includedSeats;
            return (
              <li key={seat.id} className="py-2 flex justify-between items-center gap-2">
                <div>
                  <span className="font-medium">{seat.full_name ?? seat.email}</span>
                  <span className="text-sm text-muted-foreground ml-2">{seat.role}</span>
                </div>
                <Badge variant={isExtra ? "default" : "secondary"}>
                  {isExtra ? `${extraSeatPrice} €/mois (extra)` : "inclus"}
                </Badge>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
