import { StackedCards } from "~/components/ui/stacked-cards";

const sampleCards = [
  {
    id: "1",
    date: "June 24, 2024",
    time: "3:29 PM",
    title: "Exclusive Consultation",
    amount: "$499",
    user: {
      name: "birkjernstrom",
      email: "birk@polar.sh",
      avatar: "https://avatars.githubusercontent.com/u/281715?v=4",
    },
  },
  {
    id: "2",
    date: "June 23, 2024",
    time: "1:10 PM",
  },
  {
    id: "3",
    date: "June 13, 2024",
    time: "9:51 AM",
  },
];

export default function Index() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <StackedCards cards={sampleCards} />
    </div>
  );
}
