<<<<<<< HEAD:static/assets/users_private.6e12e1ec.js
import{m as o,c as l,C as a}from"./index.e6e907a5.js";import{g as n}from"./userscore.f23fe462.js";import{e as u}from"./index.ed2c37db.js";import"./echarts.b27105f3.js";window.Alpine=o;o.data("UserGraphs",()=>({solves:null,fails:null,awards:null,solveCount:0,failCount:0,awardCount:0,getSolvePercentage(){let e=this.solveCount/(this.solveCount+this.failCount)*100;return Math.round(e)},getFailPercentage(){let e=this.failCount/(this.solveCount+this.failCount)*100;return Math.round(e)},getCategoryBreakdown(){let e=[],s={};this.solves.data.map(t=>{e.push(t.challenge.category)}),e.forEach(t=>{t in s?s[t]+=1:s[t]=1});let r=[];for(const t in s){let i=Number(s[t]/e.length*100);r.push({name:t,count:s[t],percent:i.toFixed(2),color:l(t)})}return r},async init(){this.solves=await a.pages.users.userSolves("me"),this.fails=await a.pages.users.userFails("me"),this.awards=await a.pages.users.userAwards("me"),this.solveCount=this.solves.meta.count,this.failCount=this.fails.meta.count,this.awardCount=this.awards.meta.count;let e=n(a.user.id,a.user.name,this.solves.data,this.awards.data);u(this.$refs.scoregraph,e)}}));o.start();
=======
import{m as o,c as l,C as a}from"./index.612e8617.js";import{g as n}from"./userscore.8f03c083.js";import{e as u}from"./index.8275a941.js";import"./echarts.128204f2.js";window.Alpine=o;o.data("UserGraphs",()=>({solves:null,fails:null,awards:null,solveCount:0,failCount:0,awardCount:0,getSolvePercentage(){let e=this.solveCount/(this.solveCount+this.failCount)*100;return Math.round(e)},getFailPercentage(){let e=this.failCount/(this.solveCount+this.failCount)*100;return Math.round(e)},getCategoryBreakdown(){let e=[],s={};this.solves.data.map(t=>{e.push(t.challenge.category)}),e.forEach(t=>{t in s?s[t]+=1:s[t]=1});let r=[];for(const t in s){let i=Number(s[t]/e.length*100);r.push({name:t,count:s[t],percent:i.toFixed(2),color:l(t)})}return r},async init(){this.solves=await a.pages.users.userSolves("me"),this.fails=await a.pages.users.userFails("me"),this.awards=await a.pages.users.userAwards("me"),this.solveCount=this.solves.meta.count,this.failCount=this.fails.meta.count,this.awardCount=this.awards.meta.count;let e=n(a.user.id,a.user.name,this.solves.data,this.awards.data);u(this.$refs.scoregraph,e)}}));o.start();
>>>>>>> d3e38c3afc6058fdfcf6abf0b8c7b55b1ac6c74d:static/assets/users_private.870edc11.js
