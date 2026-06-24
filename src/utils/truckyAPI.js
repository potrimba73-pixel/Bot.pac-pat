import axios from "axios";
import { TRUCKY_CONFIG } from "../config/trucky.js";

const BASE_URL = "https://e.truckyapp.com/api/v1";
const SCS_MAP_URL = "https://map.truckyapp.com";

class TruckyAPI {
    constructor() {
        this.companyId = TRUCKY_CONFIG.companyId;
        this.accessToken = TRUCKY_CONFIG.accessToken;
        this.headers = {
            "Authorization": `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
            "Accept": "application/json"
        };
    }

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

    async getCompanyMembers() {
        try {
            const response = await axios.get(`${BASE_URL}/company/${this.companyId}/members`, {
                headers: this.headers
            });
            return response.data.members || [];
        } catch (error) {
            console.error("[TruckyAPI] Erro ao obter membros:", error.message);
            return [];
        }
    }

    async getMemberStats(memberId) {
        try {
            const response = await axios.get(`${BASE_URL}/company/${this.companyId}/member/${memberId}/stats`, {
                headers: this.headers
            });
            return response.data;
        } catch (error) {
            console.error("[TruckyAPI] Erro ao obter stats do membro:", error.message);
            return null;
        }
    }

    async getMemberJobs(memberId, period = "month") {
        try {
            const response = await axios.get(`${BASE_URL}/company/${this.companyId}/member/${memberId}/jobs`, {
                headers: this.headers,
                params: { period }
            });
            return response.data.jobs || [];
        } catch (error) {
            console.error("[TruckyAPI] Erro ao obter jobs do membro:", error.message);
            return [];
        }
    }

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

    async getMemberLocation(memberId) {
        try {
            const response = await axios.get(`${BASE_URL}/company/${this.companyId}/member/${memberId}/location`, {
                headers: this.headers
            });
            return response.data;
        } catch (error) {
            console.error("[TruckyAPI] Erro ao obter localizacao:", error.message);
            return null;
        }
    }

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

    async checkMemberActivity(memberId, daysThreshold = 30) {
        const jobs = await this.getMemberJobs(memberId, "all");

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

    async checkAllMembersActivity(daysThreshold = 30) {
        const members = await this.getCompanyMembers();
        const results = {
            active: [],
            inactive: [],
            warning: [],
            totalMembers: members.length
        };

        for (const member of members) {
            const activity = await this.checkMemberActivity(member.id, daysThreshold);

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

        return results;
    }

    async getLeaderboard(period = "month", limit = 10) {
        const members = await this.getCompanyMembers();
        const memberStats = [];

        for (const member of members) {
            const stats = await this.getMemberStats(member.id);
            if (stats) {
                memberStats.push({
                    id: member.id,
                    name: member.name,
                    discordId: member.discord_id,
                    avatar: member.avatar_url,
                    role: member.role?.name,
                    totalKm: stats.total_driven_distance_km || 0,
                    totalJobs: stats.total_jobs || 0,
                    totalRevenue: stats.total_revenue || 0,
                    monthKm: stats.month_driven_distance_km || 0,
                    monthJobs: stats.month_jobs || 0
                });
            }
        }

        return memberStats
            .sort((a, b) => b.monthKm - a.monthKm)
            .slice(0, limit);
    }

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

    getMapUrlETS2() {
        return `${SCS_MAP_URL}/ets2`;
    }

    getMapUrlATS() {
        return `${SCS_MAP_URL}/ats`;
    }

    getCompanyMapUrl() {
        return `${SCS_MAP_URL}/company/${this.companyId}`;
    }
}

export default new TruckyAPI();
