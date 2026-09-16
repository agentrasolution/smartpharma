import express from "express";
import cors from "cors";
import helmet from "helmet";
import { errorHandler } from "./middleware/errors";
import { authenticate, requireActiveSubscription } from "./middleware/auth";
import { authRoutes } from "./modules/auth/auth.routes";
import { pharmacyRoutes } from "./modules/pharmacy/pharmacy.routes";
import { medicinesRoutes } from "./modules/medicines/medicines.routes";
import { salesRoutes } from "./modules/sales/sales.routes";
import { customersRoutes } from "./modules/customers/customers.routes";
import { arrearsRoutes } from "./modules/arrears/arrears.routes";
import { purchasesRoutes } from "./modules/purchases/purchases.routes";
import { suppliersRoutes } from "./modules/suppliers/suppliers.routes";
import { companiesRoutes } from "./modules/companies/companies.routes";
import { returnsRoutes } from "./modules/returns/returns.routes";
import { expensesRoutes } from "./modules/expenses/expenses.routes";
import { reportsRoutes } from "./modules/reports/reports.routes";
import { settingsRoutes } from "./modules/settings/settings.routes";
import { categoriesRoutes } from "./modules/categories/categories.routes";
import { barcodesRoutes } from "./modules/barcodes/barcodes.routes";
import { usersRoutes } from "./modules/users/users.routes";
import { rolesRoutes, permissionsRoutes } from "./modules/roles/roles.routes";
import { branchesRoutes } from "./modules/branches/branches.routes";
import { aiRoutes } from "./modules/ai/ai.routes";
import { aiInventoryRoutes } from "./modules/ai/inventory.routes";
import { purchaseOrderRoutes } from "./modules/purchase-orders/purchase-order.routes";

const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Global tenant guards. Everything except /api/auth and /api/pharmacy requires
// an authenticated user AND an active pharmacy subscription (HTTP 402 when the
// monthly billing has lapsed).
app.use("/api", (req, _res, next) => {
  const p = req.path;
  if (p === "/health" || p === "/auth" || p.startsWith("/auth/")) return next();
  void authenticate(req, _res, next);
});
app.use("/api", (req, _res, next) => {
  const p = req.path;
  if (p === "/health" || p === "/auth" || p.startsWith("/auth/") || p.startsWith("/pharmacy")) {
    return next();
  }
  void requireActiveSubscription(req, _res, next);
});

app.use("/api/auth", authRoutes);
app.use("/api/pharmacy", pharmacyRoutes);
app.use("/api/products", medicinesRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/customers", customersRoutes);
app.use("/api/arrears", arrearsRoutes);
app.use("/api/stock", purchasesRoutes);
app.use("/api/distributors", suppliersRoutes);
app.use("/api/companies", companiesRoutes);
app.use("/api/returns", returnsRoutes);
app.use("/api/expenses", expensesRoutes);
app.use("/api/dashboard", reportsRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/barcodes", barcodesRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/roles", rolesRoutes);
app.use("/api/permissions", permissionsRoutes);
app.use("/api/branches", branchesRoutes);
app.use("/api/v1/ai", aiRoutes);
app.use("/api/v1/ai/inventory", aiInventoryRoutes);
app.use("/api/v1/purchase-orders", purchaseOrderRoutes);

app.use(errorHandler);

export { app };
