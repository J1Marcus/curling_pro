Hetzner Ubuntu Server Setup Guide (Docker + Caddy)

A practical, battle‑tested checklist for provisioning a fresh Hetzner Cloud VM, securing SSH, installing Docker, deploying with Docker Compose, putting Caddy in front for TLS, and wiring up backups + monitoring. Adjust paths/domains to your project. Commands assume Ubuntu 22.04/24.04 LTS.

⸻

0) Prerequisites
	•	Hetzner Cloud account with a Project created.
	•	A local machine with: ssh, ssh-keygen, git, and a modern terminal.
	•	Domain name you control (DNS access) — e.g. example.com.
	•	Public SSH key available locally (usually ~/.ssh/id_ed25519.pub).
	•	App container image(s) or a repo containing your docker-compose.yml.

⸻

1) Provision the Server in Hetzner
	1.	Create a VM: Hetzner Cloud → Create Server.
	•	Image: Ubuntu 24.04 LTS (or 22.04 LTS)
	•	Type: start with CX22/CX32 (2–4GB RAM) or higher for heavier loads.
	•	Location: closest to your users.
	•	Networking: enable IPv4 (and IPv6 if you plan to use it).
	•	Add your SSH public key at creation time.
	•	Optional: attach a Firewall (open 22, 80, 443; drop rest).
	2.	Note the public IP assigned.

⸻

2) First SSH & Host Hardening

# From your laptop/workstation
ssh root@<SERVER_IP>
will come in via email

	1.	Create a non-root user with sudo:

adduser deploy
usermod -aG sudo deploy

	2.	Install basics:

apt update && apt -y upgrade
apt -y install ufw fail2ban git curl unzip htop

	3.	Firewall (UFW) — allow SSH, HTTP, HTTPS and rate-limit SSH:

ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw limit 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status verbose

	4.	Copy your SSH key to the new user:

cat ~/.ssh/id_ed25519.pub | ssh deploy@<IP ADDRESS> 'mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys'

	4.1 Test Connection
ssh -i ~/.ssh/id_ed25519 deploy@<IP ADDRESS>

	4.2 Create Short SSH Alias
nano ~/.ssh/config
=== ADD THIS BLOCK ===
Host <shortname>
    HostName <ip_address>_
    User deploy
    IdentityFile ~/.ssh/id_ed25519
    IdentitiesOnly yes

	5.	Harden SSH (optional but recommended):

# Fix or add SSH hardening settings
  # PermitRootLogin no
  # PasswordAuthentication no
  # PubkeyAuthentication yes
  # MaxAuthTries 3
  # AllowUsers deploy
  # Reload and restart sshd safely
grep -q "^PermitRootLogin" /etc/ssh/sshd_config \
  && sed -i 's/^.*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config \
  || echo "PermitRootLogin no" >> /etc/ssh/sshd_config
grep -q "^PasswordAuthentication" /etc/ssh/sshd_config \
  && sed -i 's/^.*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config \
  || echo "PasswordAuthentication no" >> /etc/ssh/sshd_config
grep -q "^PubkeyAuthentication" /etc/ssh/sshd_config \
  && sed -i 's/^.*PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config \
  || echo "PubkeyAuthentication yes" >> /etc/ssh/sshd_config
grep -q "^MaxAuthTries" /etc/ssh/sshd_config \
  && sed -i 's/^.*MaxAuthTries.*/MaxAuthTries 3/' /etc/ssh/sshd_config \
  || echo "MaxAuthTries 3" >> /etc/ssh/sshd_config
grep -q "^AllowUsers" /etc/ssh/sshd_config \
  && sed -i 's/^.*AllowUsers.*/AllowUsers deploy/' /etc/ssh/sshd_config \
  || echo "AllowUsers deploy" >> /etc/ssh/sshd_config
sudo systemctl reload sshd
sudo systemctl restart sshd

	6.	Reconnect as deploy:

exit
ssh deploy@<SERVER_IP>


⸻

3) Docker & Compose
	1.	Install Docker Engine (official repo):

sudo apt -y install ca-certificates gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker

	2.	Enable & test:

docker version
sudo systemctl enable docker --now


⸻

	4) Repo Setup on Server (Deploy user) — Pull via GitHub

Goal: The deploy user pulls your current GitHub repo on the server so your local ./deploy.sh can SSH in and run git pull && ./docker/start.sh.

	4.1 Create app directory & permissions

sudo mkdir -p /opt/backend
sudo chown -R deploy:deploy /opt/backend
sudo -u deploy bash -lc 'git --version || sudo apt -y install git'

	4.2 Configure Git identity (deploy user)

sudo -u deploy bash -lc '
  git config --global user.name "Deploy"
  git config --global user.email "deploy@$(hostname -f 2>/dev/null || hostname)"
'

	4.3 Preferred: GitHub Deploy Key (SSH)

Most secure & repo‑scoped.

# as root
sudo -u deploy bash -lc '
  mkdir -p ~/.ssh && chmod 700 ~/.ssh
  test -f ~/.ssh/id_ed25519 || ssh-keygen -t ed25519 -N "" -C "deploy@$(hostname)" -f ~/.ssh/id_ed25519
  echo "--- PUBLIC KEY (add to GitHub ▸ Repo ▸ Settings ▸ Deploy keys ▸ Add key ▸ Read-only) ---"
  cat ~/.ssh/id_ed25519.pub
'

Add the printed public key to GitHub:

Repo → Settings → Deploy keys → Add deploy key → paste key → Allow read access only.

Then test SSH to GitHub and clone:

sudo -u deploy bash -lc '
  ssh -o StrictHostKeyChecking=accept-new -T git@github.com || true
  cd /opt/backend
  git clone git@github.com:Nuosis/<REPO>.git .
'

	4.4 Docker group & runtime prerequisites

sudo usermod -aG docker deploy
newgrp docker <<EOF
EOF
sudo -u deploy bash -lc 'docker version'

	4.5 DNS Setup

In your DNS provider (e.g. Cloudflare, Hover, Route53):
	•	Create an A record for app.example.com → <SERVER_IP>
	•	(Optional) AAAA for IPv6 if enabled.
	•	Disable orange‑cloud proxying until after you confirm TLS is working (if using Cloudflare) to simplify first run.

Propagation can take minutes; you can check:

dig +short app.example.com A

	4.6 Caddyfile (Automatic HTTPS)

Create /opt/clarity-backend/Caddyfile:

https://api.claritybusinesssolutions.ca {
	log {
		output file /var/log/caddy/api.log
		format console
		level info
	}
	reverse_proxy api:8080
}

https://supabase.claritybusinesssolutions.ca {
	log {
		output file /var/log/caddy/supabase.log
		format console
		level info
	}
	reverse_proxy kong:8000
}

https://backend.claritybusinesssolutions.ca {
	log {
		output file /var/log/caddy/app.log
		format console
		level info
	}
	reverse_proxy app:3000
}

Caddy will request/renew Let’s Encrypt certificates automatically once DNS points the domain to your server.

	4.7 Align with your local ./deploy.sh


10 REMOTE_HOST="sewp"  # Using SSH config alias
12 HEALTH_CHECK_URL="https://api.claritybusinesssolutions.ca/health"


⸻

5) First Deployment
- set/reset the vars in app/.env && docker/env
- Copy local files to server
scp app/.env SEWP:/opt/backend/app/.env && scp docker/.env SEWP:/opt/backend/docker/.env

- verify
ssh SEWP "ls -la /opt/backend/docker/.env /opt/backend/app/.env"

- install uv
cd /opt/backend
curl -LsSf https://astral.sh/uv/install.sh | sh
uv venv
source .venv/bin/activate
uv sync


cd /opt/backend/docker
./start.sh

# Migrate
cd /opt/backend/app
sudo ./makemigration.sh

# follow logs (useful during first cert issuance)
docker compose logs -f caddy

	•	When DNS is correct, Caddy will obtain certificates. Visit: https://app.example.com.

Health check:

curl -I https://app.example.com/health


⸻

6) System Service (optional)

Keep your stack running after reboots via a tiny systemd unit that calls Compose.
Create /etc/systemd/system/clarity-stack.service:

[Unit]
Description=Clarity Docker Stack
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/clarity-backend
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target

Enable it:

sudo systemctl daemon-reload
sudo systemctl enable --now clarity-stack
systemctl status clarity-stack


⸻

7) Security & Maintenance
	•	Fail2ban: default jail protects SSH. Tune /etc/fail2ban/jail.local if desired.
	•	Unattended upgrades:

sudo apt -y install unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades

	•	SSH audits: last, lastb, journalctl -u ssh.
	•	Firewall: keep only 22/80/443 open. Consider moving SSH to a non‑standard port (plus port‑knocking or Tailscale for admin access).
	•	Server updates:

sudo apt update && sudo apt -y upgrade


⸻

8) Backups (simple, container-aware)

Volume snapshot via tar (quick & simple):

# Stop app briefly for consistent dump (or use app-level export)
cd /opt/clarity-backend
TS=$(date +%F_%H%M)
mkdir -p backups

docker compose stop app
sudo tar czf backups/app_${TS}.tgz .env Caddyfile docker-compose.yml
# add data dirs or named volumes mounts if applicable

docker compose start app

Automate with cron (e.g., nightly 3:15):

crontab -e
15 3 * * * /bin/bash -lc 'cd /opt/clarity-backend && ./scripts/backup.sh >> /var/log/clarity_backup.log 2>&1'