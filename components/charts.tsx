"use client";

import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
);

const baseOptions = {
  responsive: true,
  plugins: { legend: { labels: { color: "#ddddf0", font: { family: "IBM Plex Mono" } } } },
  scales: {
    x: { ticks: { color: "#7a7a9a" }, grid: { color: "rgba(255,255,255,0.06)" } },
    y: { ticks: { color: "#7a7a9a" }, grid: { color: "rgba(255,255,255,0.06)" } },
  },
};

export function LineChart({ data }: { data: any }) {
  return <Line options={baseOptions as any} data={data} />;
}

export function BarChart({ data }: { data: any }) {
  return <Bar options={baseOptions as any} data={data} />;
}

export function DoughnutChart({ data }: { data: any }) {
  return <Doughnut options={{ plugins: { legend: { labels: { color: "#ddddf0" } } } }} data={data} />;
}
