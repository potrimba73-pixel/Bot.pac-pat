// ============================================================
// utils/truckyAPI.js - Integração com a API do Trucky
// ============================================================

import axios from "axios";
import { TRUCKY_CONFIG } from "../config/trucky.js";

const BASE_URL = "https://e.truckyapp.com/api/v1";
const SCS_MAP_URL = "https://map.truckyapp.com";

// ============================================================
// CLASSE PRINCIPAL
// ============================================================
class TruckyAPI {
    constructor() {
        this.companyId = TRUCKY_CONFIG.companyId;
        this.accessToken = TRUCKY_CONFIG.accessToken;
        this.headers = {
            "Authorization": `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
            "Accept": "application/json"
        };
        // Cache para reduzir chamadas à API
        this.cache = {
            members: { data: null, timestamp: 0 },
            memberStats: new Map(),
            memberJobs: new Map(),
            locations: new Map(),
        };
        this.CACHE_TTL = 5 * 60 * 1000; // 5 minutos
    }

    // ===== GET COMPANY INFO =====
    async getCompanyInfo() {
        try {
            const response = await axios.get(`${BASE_URL}/company/${this.companyId}`, {
                headers: this.headers
            });
            return response.data;
        } catch (error) {
            console.error("[TruckyAPI] Erro ao obter info da empresa:", error.message);
            return null;
        }
    }

    // ===== GET COMPANY MEMBERS (COM CACHE) =====
    async getCompanyMembers(forceRefresh = false) {
        const now = Date.now();
        if (!forceRefresh && 
            this.cache.members.data && 
            now - this.cache.members.timestamp < this.CACHE_TTL) {
            return this.cache.members.data;
        }

        try {
            const response = await axios.get(`${BASE_URL}/company/${this.companyId}/members`, {
                headers: this.headers
            });
            this.cache.members.data = response.data.members || [];
            this.cache.members.timestamp = now;
            return this.cache.members.data;
        } catch (error) {
            console.error("[TruckyAPI] Erro ao obter membros:", error.message);
            return this.cache.members.data || [];
        }
    }

    // ===== GET MEMBER STATS (COM CACHE) =====
    async getMemberStats(memberId, forceRefresh = false) {
        const cacheKey = memberId;
        const now = Date.now();
        const cached = this.cache.memberStats.get(cacheKey);
        
        if (!forceRefresh && cached && (now - cached.timestamp < this.CACHE_TTL)) {
            return cached.data;
        }

        try {
            const response = await axios.get(`${BASE_URL}/company/${this.companyId}/member/${memberId}/stats`, {
                headers: this.headers
            });
            this.cache.memberStats.set(cacheKey, {
                data: response.data,
                timestamp: now
            });
            return response.data;
        } catch (error) {
            console.error("[TruckyAPI] Erro ao obter stats do membro:", error.message);
            return cached?.data || null;
        }
    }

    // ===== GET MEMBER JOBS (COM LIMITE E CACHE) =====
    async getMemberJobs(memberId, period = "month", limit = 50) {
        const cacheKey = `${memberId}_${period}`;
        const now = Date.now();
        const cached = this.cache.memberJobs.get(cacheKey);
        
        if (cached && (now - cached.timestamp < this.CACHE_TTL)) {
            return cached.data;
        }

        try {
            const response = await axios.get(`${BASE_URL}/company/${this.companyId}/member/${memberId}/jobs`, {
                headers: this.headers,
                params: { period, limit }
            });
            this.cache.memberJobs.set(cacheKey, {
                data: response.data.jobs || [],
                timestamp: now
            });
            return response.data.jobs || [];
        } catch (error) {
            console.error("[TruckyAPI] Erro ao obter jobs do membro:", error.message);
            return cached?.data || [];
        }
    }

    // ===== GET COMPANY JOBS =====
    async getCompanyJobs(period = "month") {
        try {
            const response = await axios.get(`${BASE_URL}/company/${this.companyId}/jobs`, {
                headers: this.headers,
                params: { period }
            });
            return response.data.jobs || [];
        } catch (error) {
            console.error("[TruckyAPI] Erro ao obter jobs da empresa:", error.message);
            return [];
        }
    }

    // ===== GET COMPANY STATS =====
    async getCompanyStats(period = "month") {
        try {
            const response = await axios.get(`${BASE_URL}/company/${this.companyId}/stats`, {
                headers: this.headers,
                params: { period }
            });
            return response.data;
        } catch (error) {
            console.error("[TruckyAPI] Erro ao obter stats da empresa:", error.message);
            return null;
        }
    }

    // ===== GET MEMBER LOCATION (COM CACHE CURTO) =====
    async getMemberLocation(memberId) {
        const cacheKey = memberId;
        const now = Date.now();
        const cached = this.cache.locations.get(cacheKey);
        
        // Cache mais curto para localizações (1 minuto)
        if (cached && (now - cached.timestamp < 60000)) {
            return cached.data;
        }

        try {
            const response = await axios.get(`${BASE_URL}/company/${this.companyId}/member/${memberId}/location`, {
                headers: this.headers
            });
            this.cache.locations.set(cacheKey, {
                data: response.data,
                timestamp: now
            });
            return response.data;
        } catch (error) {
            console.error("[TruckyAPI] Erro ao obter localizacao:", error.message);
            return cached?.data || null;
        }
    }

    // ===== GET COMPANY LOCATIONS =====
    async getCompanyLocations() {
        try {
            const response = await axios.get(`${BASE_URL}/company/${this.companyId}/locations`, {
                headers: this.headers
            });
            return response.data.locations || [];
        } catch (error) {
            console.error("[TruckyAPI] Erro ao obter localizacoes:", error.message);
            return [];
        }
    }

    // ===== CHECK MEMBER ACTIVITY =====
    async checkMemberActivity(memberId, daysThreshold = 30) {
        const jobs = await this.getMemberJobs(memberId, "all", 100);

        if (!jobs || jobs.length === 0) {
            return {
                active: false,
                lastJobDate: null,
                daysSinceLastJob: Infinity,
                totalJobs: 0,
                totalKm: 0
            };
        }

        const sortedJobs = jobs.sort((a, b) => 
            new Date(b.completed_at || b.started_at) - new Date(a.completed_at || a.started_at)
        );

        const lastJob = sortedJobs[0];
        const lastJobDate = new Date(lastJob.completed_at || lastJob.started_at);
        const now = new Date();
        const daysSinceLastJob = Math.floor((now - lastJobDate) / (1000 * 60 * 60 * 24));
        const totalKm = jobs.reduce((sum, job) => sum + (job.driven_distance_km || 0), 0);

        return {
            active: daysSinceLastJob <= daysThreshold,
            lastJobDate: lastJobDate,
            daysSinceLastJob: daysSinceLastJob,
            totalJobs: jobs.length,
            totalKm: Math.round(totalKm),
            lastJob: lastJob
        };
    }

    // ===== CHECK ALL MEMBERS ACTIVITY (COM PARALELISMO) =====
    async checkAllMembersActivity(daysThreshold = 30) {
        const members = await this.getCompanyMembers();
        const results = {
            active: [],
            inactive: [],
            warning: [],
            totalMembers: members.length
        };

        // Processar em lotes para evitar rate limit
        const CONCURRENCY_LIMIT = 5;
        const chunks = [];
        for (let i = 0; i < members.length; i += CONCURRENCY_LIMIT) {
            chunks.push(members.slice(i, i + CONCURRENCY_LIMIT));
        }

        for (const chunk of chunks) {
            const chunkResults = await Promise.all(
                chunk.map(member => this.checkMemberActivity(member.id, daysThreshold))
            );

            for (let i = 0; i < chunk.length; i++) {
                const member = chunk[i];
                const activity = chunkResults[i];

                const memberData = {
                    id: member.id,
                    name: member.name,
                    discordId: member.discord_id,
                    avatar: member.avatar_url,
                    role: member.role?.name || "Membro",
                    ...activity
                };

                if (activity.daysSinceLastJob === Infinity) {
                    results.inactive.push(memberData);
                } else if (activity.daysSinceLastJob > daysThreshold) {
                    results.inactive.push(memberData);
                } else if (activity.daysSinceLastJob > TRUCKY_CONFIG.inatividade.diasAviso) {
                    results.warning.push(memberData);
                } else {
                    results.active.push(memberData);
                }
            }
        }

        return results;
    }

    // ===== GET LEADERBOARD =====
    async getLeaderboard(period = "month", limit = 10) {
        const members = await this.getCompanyMembers();
        const memberStats = [];

        for (const member of members) {
            const stats = await this.getMemberStats(member.id);
            if (stats) {
                let kmKey = "month_driven_distance_km";
                let jobsKey = "month_jobs";
                
                if (period === "week") {
                    kmKey = "week_driven_distance_km";
                    jobsKey = "week_jobs";
                } else if (period === "all") {
                    kmKey = "total_driven_distance_km";
                    jobsKey = "total_jobs";
                }

                memberStats.push({
                    id: member.id,
                    name: member.name,
                    discordId: member.discord_id,
                    avatar: member.avatar_url,
                    role: member.role?.name,
                    totalKm: stats.total_driven_distance_km || 0,
                    totalJobs: stats.total_jobs || 0,
                    totalRevenue: stats.total_revenue || 0,
                    monthKm: stats[kmKey] || 0,
                    monthJobs: stats[jobsKey] || 0
                });
            }
        }

        return memberStats
            .sort((a, b) => b.monthKm - a.monthKm)
            .slice(0, limit);
    }

    // ===== GET MONTHLY STATS =====
    async getMonthlyStats() {
        const companyStats = await this.getCompanyStats("month");
        const jobs = await this.getCompanyJobs("month");
        const members = await this.getCompanyMembers();
        const leaderboard = await this.getLeaderboard("month", 3);

        return {
            totalKm: companyStats?.total_driven_distance_km || 0,
            totalJobs: companyStats?.total_jobs || 0,
            totalRevenue: companyStats?.total_revenue || 0,
            activeMembers: members.filter(m => m.role?.inactive === false).length,
            totalMembers: members.length,
            jobs: jobs.length,
            top3: leaderboard,
            period: "Este Mes"
        };
    }

    // ===== MAPAS =====
    getMapUrlETS2() {
        return `${SCS_MAP_URL}/ets2`;
    }

    getMapUrlATS() {
        return `${SCS_MAP_URL}/ats`;
    }

    getCompanyMapUrl() {
        return `${SCS_MAP_URL}/company/${this.companyId}`;
    }

    // ===== LIMPAR CACHE =====
    clearCache() {
        this.cache.members = { data: null, timestamp: 0 };
        this.cache.memberStats.clear();
        this.cache.memberJobs.clear();
        this.cache.locations.clear();
        console.log("[TruckyAPI] 🗑️ Cache limpo");
    }
}

// ============================================================
// ✅ EXPORTAÇÕES - ADICIONAR ESTA PARTE!
// ============================================================

// Criar instância única (singleton)
const truckyAPI = new TruckyAPI();

// Exportar como default (para importações sem chaves)
export default truckyAPI;

// Exportar também como named (para importações com chaves)
export { truckyAPI, TruckyAPI };
