import "@solumjs/core";
import path from "path";
import { componentScan } from "@solumjs/config";

const APP_SCAN_DIRS = ["repositories", "services", "config/beans", "controllers", "advice", "auth", "tasks"];

componentScan(path.join(__dirname), APP_SCAN_DIRS)